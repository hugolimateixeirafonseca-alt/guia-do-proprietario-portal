export const SOCIAL_CARD_THEME = Object.freeze({
  background:'#F4EFE5',
  creamSecondary:'#E9DECC',
  creamDepth:'#D8C9AF',
  ink:'#173C3D',
  petrol:'#173C3D',
  gold:'#B88A4A',
  source:'#204A4C',
  paperLine:'rgba(74,61,42,0.018)'
});

export const SOCIAL_CARD_LAYOUT = Object.freeze({
  width:1536,
  height:1024,
  safe:{left:86,right:72,top:64,bottom:62},
  illustrationStart:760,
  transitionSafeLeft:748,
  label:{left:90,top:182,width:213,height:60},
  title:{left:90,top:342,width:650,maxHeight:410},
  source:{left:90,width:620,gap:58,minTop:720,maxTop:818},
  bottomRule:{left:90,width:110,height:6,offsetTop:60},
  brand:{left:90,width:620,offsetTop:94},
  social:{
    label:{left:90,top:166,height:58,minWidth:174,maxWidth:360},
    title:{left:90,top:318,width:650,maxHeight:430},
    bottomRule:{left:90,top:838,width:110,height:6},
    brand:{left:90,top:876,width:620,height:36}
  }
});

export const SOCIAL_CARD=SOCIAL_CARD_LAYOUT;

const FONT_SIZES=[96,92,88,84,82,80,78,76,74,72,70,68,66,64,62,60,58,56,54,52,50,48,46,44,42,40,38,36,34];

function characterWidth(character,fontSize) {
  if (/\s/u.test(character)) return fontSize*0.25;
  if (/[ilI1.,:;!'|]/u.test(character)) return fontSize*0.27;
  if (/[mwMW@%&]/u.test(character)) return fontSize*0.77;
  if (/[A-ZÀ-Þ]/u.test(character)) return fontSize*0.58;
  return fontSize*0.47;
}

function textWidth(text,fontSize) {
  return [...text].reduce((total,character)=>total+characterWidth(character,fontSize),0);
}

export function wrapTitle(title,fontSize,maxWidth=SOCIAL_CARD.title.width) {
  const words=String(title||'').trim().split(/\s+/u).filter(Boolean);
  if (!words.length) return [];
  const lines=[];
  let line='';
  for (const word of words) {
    if (textWidth(word,fontSize)>maxWidth) return null;
    const candidate=line ? `${line} ${word}` : word;
    if (line && textWidth(candidate,fontSize)>maxWidth) {
      lines.push(line);
      line=word;
    } else {
      line=candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function selectTitleLayout(title,{maxWidth=SOCIAL_CARD.title.width,maxHeight=SOCIAL_CARD.title.maxHeight}={}) {
  const exactTitle=String(title||'').trim();
  if (!exactTitle) throw new Error('title is required');
  const length=[...exactTitle].length;
  const category=length<=45?'short':length<=80?'medium':length<=115?'long':'very_long';
  const preferredSize={short:96,medium:84,long:74,very_long:64}[category];
  const maxLines=category==='very_long'?6:5;
  for (const fontSize of FONT_SIZES.filter(size=>size<=preferredSize)) {
    const lines=wrapTitle(exactTitle,fontSize,maxWidth);
    if (!lines) continue;
    const lineHeight=Math.round(fontSize*1.01);
    const height=lines.length*lineHeight;
    if (lines.length<=maxLines && height<=maxHeight) {
      return {title:exactTitle,category,fontSize,lineHeight,lines,height,maxLines};
    }
  }
  throw new Error('title is too long to fit inside the safe area without truncation');
}

function element(type,style,children,extra={}) {
  return {type,props:{...extra,style,children}};
}

function graphic(type,props,children=null) {
  return {type,props:{...props,children}};
}

function editorialOverlay() {
  const dots=[];
  for (let row=0;row<8;row+=1) {
    for (let column=0;column<3;column+=1) {
      dots.push(graphic('circle',{cx:4+column*15,cy:414+row*18,r:2.2,fill:SOCIAL_CARD_THEME.gold,opacity:0.46}));
    }
  }
  return element('svg',{
    display:'flex',position:'absolute',left:0,top:0,
    width:SOCIAL_CARD.width,height:SOCIAL_CARD.height
  },[
    graphic('path',{d:'M806 0H982C875 137 817 302 815 500C787 557 764 621 748 692C759 607 771 539 766 458C754 282 769 126 806 0Z',fill:SOCIAL_CARD_THEME.petrol}),
    graphic('path',{d:'M500 0H806C769 140 758 302 772 478C768 626 692 840 604 1024H500Z',fill:SOCIAL_CARD_THEME.creamDepth}),
    graphic('path',{d:'M500 0H610C656 146 702 323 704 510C704 672 637 824 520 1024H500Z',fill:SOCIAL_CARD_THEME.creamSecondary}),
    graphic('path',{d:'M0 0H500C617 182 683 351 690 514C697 682 614 865 520 1024H0Z',fill:SOCIAL_CARD_THEME.background}),
    graphic('path',{d:'M812 510C775 599 747 707 738 823C817 813 892 795 965 773C891 697 840 605 812 510Z',fill:SOCIAL_CARD_THEME.gold,opacity:0.93}),
    graphic('path',{d:'M500 -18C628 184 692 357 690 521C688 699 615 878 520 1042',fill:'none',stroke:SOCIAL_CARD_THEME.gold,strokeWidth:1.45,opacity:0.78}),
    graphic('path',{d:'M-110 337C-33 350 16 416 16 503C16 586-29 649-98 671',fill:'none',stroke:SOCIAL_CARD_THEME.gold,strokeWidth:1.2,opacity:0.28}),
    ...dots
  ],{viewBox:'0 0 1536 1024',width:1536,height:1024,'aria-hidden':'true'});
}

function socialOverlay() {
  return element('svg',{
    display:'flex',position:'absolute',left:0,top:0,
    width:SOCIAL_CARD.width,height:SOCIAL_CARD.height
  },[
    graphic('path',{d:'M0 0H624C694 137 727 300 724 485C721 677 678 858 601 1024H0Z',fill:SOCIAL_CARD_THEME.background,opacity:0.985}),
    graphic('path',{d:'M600 0H716C760 159 770 323 754 488C739 649 699 813 626 1024H569C654 845 697 675 700 491C703 306 670 144 600 0Z',fill:SOCIAL_CARD_THEME.creamSecondary,opacity:0.96}),
    graphic('path',{d:'M622 -12C704 172 728 338 713 511C700 685 658 851 587 1037',fill:'none',stroke:SOCIAL_CARD_THEME.gold,strokeWidth:2.2,opacity:0.82}),
    graphic('circle',{cx:88,cy:770,r:5,fill:SOCIAL_CARD_THEME.gold,opacity:0.55}),
    graphic('circle',{cx:110,cy:770,r:5,fill:SOCIAL_CARD_THEME.gold,opacity:0.34}),
    graphic('circle',{cx:132,cy:770,r:5,fill:SOCIAL_CARD_THEME.gold,opacity:0.2})
  ],{viewBox:'0 0 1536 1024',width:1536,height:1024,'aria-hidden':'true'});
}

function titleNodes(titleLayout,width) {
  return titleLayout.lines.map((line,index)=>element('div',{
    display:'flex',width,height:titleLayout.lineHeight,alignItems:'center'
  },line,{key:`title-${index}`}));
}

function createNewsCardLayout({title,source,image}) {
  const exactSource=String(source||'').trim();
  if (!exactSource) throw new Error('source is required');
  if (!image) throw new Error('base image is required');
  const titleLayout=selectTitleLayout(title);
  const titleBottom=SOCIAL_CARD.title.top+titleLayout.height;
  const sourceTop=Math.min(
    SOCIAL_CARD.source.maxTop,
    Math.max(SOCIAL_CARD.source.minTop,titleBottom+SOCIAL_CARD.source.gap)
  );
  const bottomRuleTop=sourceTop+SOCIAL_CARD.bottomRule.offsetTop;
  const brandTop=sourceTop+SOCIAL_CARD.brand.offsetTop;
  const tree=element('div',{
    display:'flex',position:'relative',width:SOCIAL_CARD.width,height:SOCIAL_CARD.height,
    overflow:'hidden',backgroundColor:SOCIAL_CARD_THEME.background
  },[
    element('img',{
      position:'absolute',left:0,top:0,width:SOCIAL_CARD.width,height:SOCIAL_CARD.height,
      objectFit:'cover'
    },null,{src:image,width:SOCIAL_CARD.width,height:SOCIAL_CARD.height}),
    editorialOverlay(),
    element('div',{
      display:'flex',position:'absolute',left:0,top:0,width:SOCIAL_CARD.transitionSafeLeft,height:SOCIAL_CARD.height,
      backgroundImage:`repeating-linear-gradient(0deg, ${SOCIAL_CARD_THEME.paperLine} 0px, ${SOCIAL_CARD_THEME.paperLine} 1px, rgba(244,239,229,0) 1px, rgba(244,239,229,0) 9px)`,
      opacity:0.7
    },null),
    element('div',{
      display:'flex',position:'absolute',left:SOCIAL_CARD.label.left,top:SOCIAL_CARD.label.top,
      width:SOCIAL_CARD.label.width,height:SOCIAL_CARD.label.height,borderRadius:30,
      alignItems:'center',justifyContent:'center',backgroundColor:SOCIAL_CARD_THEME.petrol,color:'#F7F2E9',
      fontFamily:'Lato',fontWeight:700,fontSize:27,letterSpacing:4.2
    },'NOTÍCIAS'),
    element('div',{
      display:'flex',position:'absolute',left:SOCIAL_CARD.title.left,top:SOCIAL_CARD.title.top,
      width:SOCIAL_CARD.title.width,height:titleLayout.height,flexDirection:'column',
      color:SOCIAL_CARD_THEME.ink,fontFamily:'Cormorant Garamond',fontWeight:500,
      fontSize:titleLayout.fontSize,lineHeight:1,letterSpacing:-0.35
    },titleNodes(titleLayout,SOCIAL_CARD.title.width)),
    element('div',{
      display:'flex',position:'absolute',left:SOCIAL_CARD.source.left,top:sourceTop,
      width:SOCIAL_CARD.source.width,height:38,alignItems:'center',
      color:SOCIAL_CARD_THEME.source,fontFamily:'Lato',fontWeight:400,fontSize:29
    },[
      element('span',{display:'flex',fontWeight:700},'Fonte:'),
      element('span',{display:'flex',marginLeft:9},exactSource)
    ]),
    element('div',{
      display:'flex',position:'absolute',left:SOCIAL_CARD.bottomRule.left,top:bottomRuleTop,
      width:SOCIAL_CARD.bottomRule.width,height:SOCIAL_CARD.bottomRule.height,
      backgroundColor:SOCIAL_CARD_THEME.gold
    },null),
    element('div',{
      display:'flex',position:'absolute',left:SOCIAL_CARD.brand.left,top:brandTop,
      width:SOCIAL_CARD.brand.width,height:34,alignItems:'center',
      color:SOCIAL_CARD_THEME.ink,fontFamily:'Cormorant Garamond',fontWeight:500,fontSize:28,letterSpacing:0
    },'Guia do Proprietário'),
  ],{lang:'pt-PT'});

  return {
    tree,
    metrics:{
      width:SOCIAL_CARD.width,
      height:SOCIAL_CARD.height,
      safe:SOCIAL_CARD.safe,
      illustrationStart:SOCIAL_CARD.illustrationStart,
      transitionSafeLeft:SOCIAL_CARD.transitionSafeLeft,
      label:SOCIAL_CARD.label,
      source:{...SOCIAL_CARD.source,top:sourceTop},
      brand:{...SOCIAL_CARD.brand,top:brandTop},
      title:{...SOCIAL_CARD.title,...titleLayout,bottom:titleBottom},
      exactSource,
      variant:'news',
      badge:'NOTÍCIAS'
    }
  };
}

function normalizeBadge(value) {
  const badge=String(value||'GUIA').trim().toUpperCase();
  return badge || 'GUIA';
}

function socialBadgeWidth(badge) {
  return Math.max(
    SOCIAL_CARD.social.label.minWidth,
    Math.min(SOCIAL_CARD.social.label.maxWidth,100+[...badge].length*15)
  );
}

function createSocialVariantLayout({title,badge,image}) {
  if (!image) throw new Error('base image is required');
  const exactBadge=normalizeBadge(badge);
  const socialTitle=SOCIAL_CARD.social.title;
  const titleLayout=selectTitleLayout(title,{maxWidth:socialTitle.width,maxHeight:socialTitle.maxHeight});
  const titleBottom=socialTitle.top+titleLayout.height;
  const badgeWidth=socialBadgeWidth(exactBadge);
  const tree=element('div',{
    display:'flex',position:'relative',width:SOCIAL_CARD.width,height:SOCIAL_CARD.height,
    overflow:'hidden',backgroundColor:SOCIAL_CARD_THEME.background
  },[
    element('img',{
      position:'absolute',left:0,top:0,width:SOCIAL_CARD.width,height:SOCIAL_CARD.height,
      objectFit:'cover'
    },null,{src:image,width:SOCIAL_CARD.width,height:SOCIAL_CARD.height}),
    socialOverlay(),
    element('div',{
      display:'flex',position:'absolute',left:0,top:0,width:SOCIAL_CARD.transitionSafeLeft,height:SOCIAL_CARD.height,
      backgroundImage:`repeating-linear-gradient(0deg, ${SOCIAL_CARD_THEME.paperLine} 0px, ${SOCIAL_CARD_THEME.paperLine} 1px, rgba(244,239,229,0) 1px, rgba(244,239,229,0) 10px)`,
      opacity:0.38
    },null),
    element('div',{
      display:'flex',position:'absolute',left:SOCIAL_CARD.social.label.left,top:SOCIAL_CARD.social.label.top,
      width:badgeWidth,height:SOCIAL_CARD.social.label.height,borderRadius:29,
      alignItems:'center',justifyContent:'center',backgroundColor:SOCIAL_CARD_THEME.petrol,color:'#F7F2E9',
      fontFamily:'Lato',fontWeight:700,fontSize:25,letterSpacing:exactBadge.length>12?2.1:3.6,
      paddingLeft:22,paddingRight:22
    },exactBadge),
    element('div',{
      display:'flex',position:'absolute',left:socialTitle.left,top:socialTitle.top,
      width:socialTitle.width,height:titleLayout.height,flexDirection:'column',
      color:SOCIAL_CARD_THEME.ink,fontFamily:'Cormorant Garamond',fontWeight:500,
      fontSize:titleLayout.fontSize,lineHeight:1,letterSpacing:-0.35
    },titleNodes(titleLayout,socialTitle.width)),
    element('div',{
      display:'flex',position:'absolute',left:SOCIAL_CARD.social.bottomRule.left,top:SOCIAL_CARD.social.bottomRule.top,
      width:SOCIAL_CARD.social.bottomRule.width,height:SOCIAL_CARD.social.bottomRule.height,
      backgroundColor:SOCIAL_CARD_THEME.gold
    },null),
    element('div',{
      display:'flex',position:'absolute',left:SOCIAL_CARD.social.brand.left,top:SOCIAL_CARD.social.brand.top,
      width:SOCIAL_CARD.social.brand.width,height:SOCIAL_CARD.social.brand.height,alignItems:'center',
      color:SOCIAL_CARD_THEME.ink,fontFamily:'Cormorant Garamond',fontWeight:500,fontSize:30,letterSpacing:0
    },'Guia do Proprietário')
  ],{lang:'pt-PT'});

  return {
    tree,
    metrics:{
      width:SOCIAL_CARD.width,
      height:SOCIAL_CARD.height,
      safe:SOCIAL_CARD.safe,
      illustrationStart:SOCIAL_CARD.illustrationStart,
      transitionSafeLeft:SOCIAL_CARD.transitionSafeLeft,
      label:{...SOCIAL_CARD.social.label,width:badgeWidth},
      source:null,
      brand:SOCIAL_CARD.social.brand,
      title:{...socialTitle,...titleLayout,bottom:titleBottom},
      exactSource:'',
      variant:'social',
      badge:exactBadge
    }
  };
}

export function createSocialCardLayout({title,source,pillar='casa',image,variant='news',badge}) {
  void pillar;
  if (variant==='social') return createSocialVariantLayout({title,badge,image});
  return createNewsCardLayout({title,source,image});
}
