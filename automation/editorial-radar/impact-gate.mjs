export function shouldAssessContentImpact(classification={}, {
  minNewsScore=70,
  minSeoScore=80,
  minLeadScore=80
}={}) {
  return Number(classification.news_score||0)>=minNewsScore
    || Number(classification.seo_score||0)>=minSeoScore
    || Number(classification.lead_score||0)>=minLeadScore;
}
