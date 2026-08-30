import { MAX_REVERSE_IMAGES, MAX_UPLOAD_FILES, MIN_UPLOAD_FILES } from "./constants.mjs";
import { deduplicatePhotos } from "./perceptual-hash.mjs";
import { buildReportModel } from "./report.mjs";
import { normalizeExtractionGeometry, validateClassification, validateExtraction, VerificationValidationError } from "./validate.mjs";

export class ClosedAnalysisError extends Error {
  constructor(stage, cause) {
    super(`Falha fechada na etapa ${stage}.`);
    this.name = "ClosedAnalysisError";
    this.stage = stage;
    this.cause = cause;
    this.refundRequired = true;
  }
}

async function runValidatedWithRetry(stage, operation, validate) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const result = await operation({ attempt });
      return validate(result);
    } catch (error) {
      lastError = error;
      if (!(error instanceof VerificationValidationError) && attempt === 1) continue;
    }
  }
  throw new ClosedAnalysisError(stage, lastError);
}

export function createAnalysisEngine(dependencies) {
  const {
    extractor,
    photoProcessor,
    reverseImageProvider,
    candidateValidator,
    priceReferenceProvider,
    classifier
  } = dependencies;

  return {
    async analyze({ images, city }) {
      if (!Array.isArray(images) || images.length < MIN_UPLOAD_FILES || images.length > MAX_UPLOAD_FILES) {
        throw new TypeError(`A análise requer entre ${MIN_UPLOAD_FILES} e ${MAX_UPLOAD_FILES} imagens.`);
      }

      const extraction = await runValidatedWithRetry(
        "extracao",
        ({ attempt }) => extractor.extract({ images, city, attempt }),
        (result) => validateExtraction(normalizeExtractionGeometry(result), images.length)
      );

      const prepared = await photoProcessor.prepare({ images, regions: extraction.regioes_fotografias });
      const { unique, duplicates } = deduplicatePhotos(prepared);
      const searchable = unique.slice(0, MAX_REVERSE_IMAGES);
      const reverseResults = [];
      let technicalFailures = 0;
      let lastTechnicalFailure;

      for (const photo of searchable) {
        try {
          const candidates = await reverseImageProvider.search(photo);
          if (!candidates.length) {
            reverseResults.push({
              id: `imagem_${photo.id}_sem_resultado`,
              photo_id: photo.id,
              provider: reverseImageProvider.name,
              state: "sem_correspondencia_encontrada",
              match_type: "similar",
              source_url: null,
              source_domain: null,
              matched_image_url: null,
              context_verified: false,
              context_excerpt: null,
              source_location: null,
              source_date: null
            });
            continue;
          }
          for (const candidate of candidates) {
            reverseResults.push(await candidateValidator.validate({ photo, candidate, city, extraction }));
          }
        } catch (error) {
          technicalFailures += 1;
          lastTechnicalFailure = error;
          reverseResults.push({
            id: `imagem_${photo.id}_indisponivel`,
            photo_id: photo.id,
            provider: reverseImageProvider.name,
            state: "pesquisa_indisponivel",
            match_type: "similar",
            source_url: null,
            source_domain: null,
            matched_image_url: null,
            context_verified: false,
            context_excerpt: null,
            source_location: null,
            source_date: null
          });
        }
      }

      if (searchable.length > 0 && technicalFailures === searchable.length) {
        throw new ClosedAnalysisError(
          "pesquisa_visual",
          lastTechnicalFailure instanceof Error ? lastTechnicalFailure : new Error("Nenhuma pesquisa visual foi concluída.")
        );
      }

      const priceReference = await priceReferenceProvider.lookup({ city, facts: extraction.factos });
      const evidence = [
        ...extraction.factos,
        ...reverseResults,
        ...(priceReference ? [priceReference] : [])
      ];
      const evidenceIds = evidence.map((item) => item.id);

      const classification = await runValidatedWithRetry(
        "classificacao",
        ({ attempt }) => classifier.classify({ extraction, reverseResults, priceReference, attempt }),
        (result) => validateClassification(result, evidenceIds)
      );

      return {
        extraction,
        photos: { unique: searchable, duplicates },
        reverseResults,
        priceReference,
        report: buildReportModel({ classification, evidence, priceReference })
      };
    }
  };
}
