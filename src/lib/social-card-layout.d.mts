export interface SocialCardMetrics {
  width:number;
  height:number;
  safe:{left:number;right:number;top:number;bottom:number};
  illustrationStart:number;
  transitionSafeLeft:number;
  label:{left:number;top:number;width:number;height:number};
  source:{left:number;top:number;width:number};
  brand:{left:number;top:number;width:number};
  title:{
    left:number;top:number;width:number;maxHeight:number;bottom:number;
    title:string;category:string;fontSize:number;lineHeight:number;lines:string[];height:number;maxLines:number;
  };
  exactSource:string;
}

export const SOCIAL_CARD:{
  width:number;height:number;
  safe:{left:number;right:number;top:number;bottom:number};
  illustrationStart:number;
  transitionSafeLeft:number;
  label:{left:number;top:number;width:number;height:number};
  topRule:{left:number;top:number;width:number;height:number};
  title:{left:number;top:number;width:number;maxHeight:number};
  source:{left:number;top:number;width:number};
  bottomRule:{left:number;top:number;width:number;height:number};
  brand:{left:number;top:number;width:number};
};

export const SOCIAL_CARD_LAYOUT:typeof SOCIAL_CARD;
export const SOCIAL_CARD_THEME:{
  background:string;creamSecondary:string;creamDepth:string;ink:string;
  petrol:string;gold:string;source:string;paperLine:string;
};

export function wrapTitle(title:string,fontSize:number,maxWidth?:number):string[]|null;
export function selectTitleLayout(title:string):{
  title:string;category:string;fontSize:number;lineHeight:number;lines:string[];height:number;maxLines:number;
};
export function createSocialCardLayout(input:{
  title:string;source:string;pillar?:string;image:ArrayBuffer|Uint8Array|string;
}):{tree:unknown;metrics:SocialCardMetrics};
