export function shouldUpgradeLegacyPublication(existing={},classification={},minNewsScore=70) {
  return !Number(existing.published||0)
    && Number(existing.news_score||0)<minNewsScore
    && Number(classification.news_score||0)>=minNewsScore;
}
