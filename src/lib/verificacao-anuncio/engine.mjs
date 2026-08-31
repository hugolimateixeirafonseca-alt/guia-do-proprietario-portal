import { MAX_UPLOAD_FILES, MIN_UPLOAD_FILES } from "./constants.mjs";
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
    priceReferenceProvider,
    classifier
  } = dependencies;

  return {
    async analyze({ images, city, extraction: providedExtraction = null }) {
      if (!Array.isArray(images) || images.length < MIN_UPLOAD_FILES || images.length > MAX_UPLOAD_FILES) {
        throw new TypeError(`A análise requer entre ${MIN_UPLOAD_FILES} e ${MAX_UPLOAD_FILES} imagens.`);
      }

      const extraction = providedExtraction
        ? validateExtraction(normalizeExtractionGeometry(providedExtraction), images.length)
        : await runValidatedWithRetry(
          "extracao",
          ({ attempt }) => extractor.extract({ images, city, attempt }),
          (result) => validateExtraction(normalizeExtractionGeometry(result), images.length)
        );

      const priceReference = await priceReferenceProvider.lookup({ city, facts: extraction.factos });
      const evidence = [
        ...extraction.factos,
        ...(extraction.leituras_visuais ?? []),
        ...(priceReference ? [priceReference] : [])
      ];
      const evidenceIds = evidence.map((item) => item.id);

      const classification = await runValidatedWithRetry(
        "classificacao",
        ({ attempt }) => classifier.classify({ extraction, priceReference, attempt }),
        (result) => validateClassification(result, evidenceIds)
      );

      return {
        extraction,
        priceReference,
        report: buildReportModel({ classification, evidence, priceReference })
      };
    }
  };
}
