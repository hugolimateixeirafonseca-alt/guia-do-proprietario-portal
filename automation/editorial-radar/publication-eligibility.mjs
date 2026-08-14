export const DEFAULT_MIN_NEWS_SCORE=70;

export function isPublishableNews(newsScore,minNewsScore=DEFAULT_MIN_NEWS_SCORE) {
  const score=Number(newsScore);
  const minimum=Number(minNewsScore);
  return Number.isFinite(score)&&Number.isFinite(minimum)&&score>=minimum;
}
