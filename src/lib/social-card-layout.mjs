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
  illustrationStart:746,
  transitionSafeLeft:724,
  label:{left:86,top:182,width:213,height:60},
  topRule:{left:94,top:274,width:110,height:6},
  title:{left:90,top:348,width:620,maxHeight:390},
  source:{left:93,top:826,width:610},
  bottomRule:{left:93,top:888,width:110,height:6},
  brand:{left:93,top:922,width:610}
});

export const SOCIAL_CARD=SOCIAL_CARD_LAYOUT;

const FONT_SIZES=[84,80,76,72,68,64,62,60,58,56,54,52,50,48,46,44,42,40,38,36,34];

function characterWidth(character,fontSize) {
  if (/\s/u.test(character)) return fontSize*0.28;
  if (/[ilI1.,:;!'|]/u.test(character)) return fontSize*0.3;
  if (/[mwMW@%&]/u.test(character)) return fontSize*0.88;
  if (/[A-ZÀ-Þ]/u.test(character)) return fontSize*0.66;
  return fontSize*0.53;
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

export function selectTitleLayout(title) {
  const exactTitle=String(title||'').trim();
  if (!exactTitle) throw new Error('title is required');
  const length=[...exactTitle].length;
  const category=length<=45?'short':length<=80?'medium':length<=115?'long':'very_long';
  const preferredSize={short:84,medium:72,long:62,very_long:54}[category];
  const maxLines=category==='very_long'?6:5;
  for (const fontSize of FONT_SIZES.filter(size=>size<=preferredSize)) {
    const lines=wrapTitle(exactTitle,fontSize);
    if (!lines) continue;
    const lineHeight=Math.round(fontSize*1.03);
    const height=lines.length*lineHeight;
    if (lines.length<=maxLines && height<=SOCIAL_CARD.title.maxHeight) {
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
    graphic('path',{d:'M870 0H1004C881 143 807 335 816 524C825 695 752 846 666 1024H570C690 820 760 670 740 520C715 330 760 145 870 0Z',fill:SOCIAL_CARD_THEME.petrol}),
    graphic('path',{d:'M585 0H889C809 132 765 297 771 468C778 650 701 847 610 1024H500C617 827 691 676 691 512C689 327 642 148 585 0Z',fill:SOCIAL_CARD_THEME.creamSecondary}),
    graphic('path',{d:'M0 0H500C626 183 703 354 710 515C718 694 621 883 520 1024H0Z',fill:SOCIAL_CARD_THEME.background}),
    graphic('path',{d:'M815 515C755 602 731 720 739 823C817 812 891 793 950 777C874 699 836 604 815 515Z',fill:SOCIAL_CARD_THEME.gold,opacity:0.96}),
    graphic('path',{d:'M500 -18C642 187 712 365 710 525C708 702 620 884 520 1042',fill:'none',stroke:SOCIAL_CARD_THEME.gold,strokeWidth:1.6,opacity:0.82}),
    graphic('path',{d:'M-110 337C-33 350 16 416 16 503C16 586-29 649-98 671',fill:'none',stroke:SOCIAL_CARD_THEME.gold,strokeWidth:1.2,opacity:0.28}),
    ...dots
  ],{viewBox:'0 0 1536 1024',width:1536,height:1024,'aria-hidden':'true'});
}

export function createSocialCardLayout({title,source,pillar='casa',image}) {
  const exactSource=String(source||'').trim();
  if (!exactSource) throw new Error('source is required');
  if (!image) throw new Error('base image is required');
  const titleLayout=selectTitleLayout(title);
  const titleBottom=SOCIAL_CARD.title.top+titleLayout.height;
  const titleNodes=titleLayout.lines.map((line,index)=>element('div',{
    display:'flex',
    width:SOCIAL_CARD.title.width,
    height:titleLayout.lineHeight,
    alignItems:'center'
  },line,{key:`title-${index}`}));
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
      display:'flex',position:'absolute',left:SOCIAL_CARD.topRule.left,top:SOCIAL_CARD.topRule.top,
      width:SOCIAL_CARD.topRule.width,height:SOCIAL_CARD.topRule.height,
      backgroundColor:SOCIAL_CARD_THEME.gold
    },null),
    element('div',{
      display:'flex',position:'absolute',left:SOCIAL_CARD.title.left,top:SOCIAL_CARD.title.top,
      width:SOCIAL_CARD.title.width,height:titleLayout.height,flexDirection:'column',
      color:SOCIAL_CARD_THEME.ink,fontFamily:'Old Standard TT',fontWeight:700,
      fontSize:titleLayout.fontSize,lineHeight:1,letterSpacing:-0.7
    },titleNodes),
    element('div',{
      display:'flex',position:'absolute',left:SOCIAL_CARD.source.left,top:SOCIAL_CARD.source.top,
      width:SOCIAL_CARD.source.width,height:38,alignItems:'center',
      color:SOCIAL_CARD_THEME.source,fontFamily:'Lato',fontWeight:400,fontSize:29
    },[
      element('span',{display:'flex',fontWeight:700},'Fonte:'),
      element('span',{display:'flex',marginLeft:9},exactSource)
    ]),
    element('div',{
      display:'flex',position:'absolute',left:SOCIAL_CARD.bottomRule.left,top:SOCIAL_CARD.bottomRule.top,
      width:SOCIAL_CARD.bottomRule.width,height:SOCIAL_CARD.bottomRule.height,
      backgroundColor:SOCIAL_CARD_THEME.gold
    },null),
    element('div',{
      display:'flex',position:'absolute',left:SOCIAL_CARD.brand.left,top:SOCIAL_CARD.brand.top,
      width:SOCIAL_CARD.brand.width,height:34,alignItems:'center',
      color:SOCIAL_CARD_THEME.ink,fontFamily:'Old Standard TT',fontWeight:700,fontSize:29,letterSpacing:0
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
      source:SOCIAL_CARD.source,
      brand:SOCIAL_CARD.brand,
      title:{...SOCIAL_CARD.title,...titleLayout,bottom:titleBottom},
      exactSource
    }
  };
}
