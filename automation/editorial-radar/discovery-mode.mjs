const INCREMENTAL_SWEEPS=[
  'legislacao_fiscalidade',
  'condominio_vizinhos',
  'arrendamento',
  'mercado_credito',
  'fontes_media_a',
  'fontes_media_b',
  'fontes_media_c',
  'fontes_oficiais',
  'omissoes_editor_chefe'
];

export function getDiscoveryModePlan(mode) {
  if (mode==='smoke') return {
    directHarvest:true,
    prefilterLimit:24,
    benchmark:true,
    sweepNames:['omissoes_editor_chefe']
  };
  if (mode==='morning') return {
    directHarvest:true,
    prefilterLimit:30,
    benchmark:false,
    sweepNames:['fontes_oficiais','omissoes_editor_chefe']
  };
  return {
    directHarvest:false,
    prefilterLimit:0,
    benchmark:false,
    sweepNames:INCREMENTAL_SWEEPS
  };
}
