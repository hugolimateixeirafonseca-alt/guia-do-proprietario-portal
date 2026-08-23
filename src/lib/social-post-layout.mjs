export const SOCIAL_POST_CARD=Object.freeze({
  width:1536,
  height:1024,
  image:{left:560,top:0,width:976,height:1024},
  textSafeRight:682,
  label:{left:82,top:128,height:68,minWidth:196,maxWidth:430},
  title:{left:76,top:286,width:592,maxHeight:458},
  footer:{left:76,top:826,width:420},
  brand:{left:76,top:900,width:610,height:46},
  curve:{topX:835,midX:718,bottomX:930},
  watermark:{left:390,top:650,width:300,height:270}
});

export const SOCIAL_POST_THEME=Object.freeze({
  background:'#F6F0E6',
  backgroundSoft:'#FBF7EF',
  ink:'#163B38',
  petrol:'#153C38',
  petrolDeep:'#0E302D',
  petrolSoft:'#315C55',
  gold:'#B78943',
  goldLight:'#D6B873',
  goldPale:'#E8D8B3',
  creamSecondary:'#E8DDCB',
  creamTertiary:'#F0E7D9',
  white:'#FFFDF8'
});

const FONT_SIZES=[104,100,96,92,88,84,80,76,72,68,64,62];

function characterWidth(character,fontSize){
  if (/\s/u.test(character)) return fontSize*0.25;
  if (/[ilI1.,:;!'|]/u.test(character)) return fontSize*0.27;
  if (/[mwMW@%&]/u.test(character)) return fontSize*0.77;
  if (/[A-ZÀ-Þ]/u.test(character)) return fontSize*0.58;
  return fontSize*0.47;
}

function textWidth(text,fontSize){
  return [...text].reduce((total,character)=>total+characterWidth(character,fontSize),0);
}

function wrapTitle(title,fontSize,maxWidth){
  const words=String(title||'').trim().split(/\s+/u).filter(Boolean);
  if (!words.length) return [];
  const lines=[];
  let line='';
  for (const word of words){
    if (textWidth(word,fontSize)>maxWidth) return null;
    const candidate=line?`${line} ${word}`:word;
    if (line&&textWidth(candidate,fontSize)>maxWidth){
      lines.push(line);
      line=word;
    }else{
      line=candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function selectSocialPostTitleLayout(title){
  const exactTitle=String(title||'').trim();
  if (!exactTitle) throw new Error('title is required');
  if ([...exactTitle].length>88) throw new Error('title is too long for social card');
  for (const fontSize of FONT_SIZES){
    const lines=wrapTitle(exactTitle,fontSize,SOCIAL_POST_CARD.title.width);
    if (!lines) continue;
    const lineHeight=Math.round(fontSize*1.01);
    const height=lines.length*lineHeight;
    if (lines.length<=5&&height<=SOCIAL_POST_CARD.title.maxHeight){
      return {title:exactTitle,fontSize,lineHeight,lines,height,maxLines:5};
    }
  }
  throw new Error('title is too long for social card');
}

function element(type,style,children,extra={}){
  return {type,props:{...extra,style,children}};
}

function graphic(type,props,children=null){
  return {type,props:{...props,children}};
}

function normalizeBadge(value){
  const badge=String(value||'GUIA').trim().toUpperCase();
  return badge||'GUIA';
}

function normalizePillar(value){
  const pillar=String(value||'casa').trim().toLowerCase();
  return ['casa','impostos','arrendamento','arrendar','condominio','vender','herancas'].includes(pillar)?pillar:'casa';
}

function badgeWidth(badge){
  return Math.max(
    SOCIAL_POST_CARD.label.minWidth,
    Math.min(SOCIAL_POST_CARD.label.maxWidth,110+[...badge].length*16)
  );
}

function watermarkForPillar(pillar){
  const stroke=SOCIAL_POST_THEME.gold;
  const common={fill:'none',stroke,strokeWidth:4.4,strokeLinecap:'round',strokeLinejoin:'round'};
  if (pillar==='impostos'){
    return [
      graphic('path',{...common,d:'M52 28 H154 L188 62 V194 H52 Z'}),
      graphic('path',{...common,d:'M154 28 V64 H188'}),
      graphic('path',{...common,d:'M78 94 H160 M78 120 H148 M78 146 H136'}),
      graphic('circle',{...common,cx:84,cy:178,r:30}),
      graphic('path',{...common,d:'M96 164 C88 155 70 157 68 173 C66 190 88 199 99 186 M64 176 H91 M64 184 H88'})
    ];
  }
  if (pillar==='arrendamento'||pillar==='arrendar'){
    return [
      graphic('path',{...common,d:'M34 108 L110 42 L186 108 V194 H34 Z'}),
      graphic('path',{...common,d:'M86 194 V132 H134 V194'}),
      graphic('circle',{...common,cx:145,cy:72,r:25}),
      graphic('path',{...common,d:'M123 86 L79 130 M79 130 L64 116 M79 130 L64 145'})
    ];
  }
  if (pillar==='condominio'){
    return [
      graphic('path',{...common,d:'M48 194 V56 H172 V194 Z'}),
      graphic('path',{...common,d:'M74 82 H96 V104 H74 Z M124 82 H146 V104 H124 Z M74 124 H96 V146 H74 Z M124 124 H146 V146 H124 Z'}),
      graphic('path',{...common,d:'M94 194 V160 H126 V194'})
    ];
  }
  if (pillar==='vender'){
    return [
      graphic('path',{...common,d:'M30 108 L104 44 L178 108 V194 H30 Z'}),
      graphic('circle',{...common,cx:162,cy:72,r:26}),
      graphic('path',{...common,d:'M140 88 L103 125 M103 125 L88 112 M103 125 L90 140'})
    ];
  }
  return [
    graphic('path',{...common,d:'M30 108 L110 40 L190 108 V194 H30 Z'}),
    graphic('path',{...common,d:'M82 194 V126 H138 V194'}),
    graphic('path',{...common,d:'M54 94 V58 H78 V74'})
  ];
}

function createWatermark(pillar){
  return element('svg',{
    display:'flex',position:'absolute',
    left:SOCIAL_POST_CARD.watermark.left,top:SOCIAL_POST_CARD.watermark.top,
    width:SOCIAL_POST_CARD.watermark.width,height:SOCIAL_POST_CARD.watermark.height,
    opacity:0.095
  },watermarkForPillar(pillar),{viewBox:'0 0 220 220',width:220,height:220,'aria-hidden':'true'});
}

function createHouseFooterIcon(){
  return element('svg',{
    display:'flex',position:'absolute',left:76,top:824,width:44,height:44
  },[
    graphic('path',{d:'M4 20 L22 5 L40 20 M9 18 V38 H35 V18 M17 38 V25 H27 V38',fill:'none',stroke:SOCIAL_POST_THEME.gold,strokeWidth:2.3,strokeLinecap:'round',strokeLinejoin:'round'}),
    graphic('circle',{cx:22,cy:22,r:20,fill:'none',stroke:SOCIAL_POST_THEME.goldPale,strokeWidth:1,opacity:0.75})
  ],{viewBox:'0 0 44 44',width:44,height:44,'aria-hidden':'true'});
}

function createPaperTexture(){
  const marks=[];
  for(let i=0;i<14;i+=1){
    const x=28+(i%5)*132+(i%2)*17;
    const y=40+Math.floor(i/5)*300+(i%3)*37;
    marks.push(graphic('circle',{cx:x,cy:y,r:i%3===0?1.5:1,fill:SOCIAL_POST_THEME.gold,opacity:0.06}));
  }
  for(let i=0;i<8;i+=1){
    const y=96+i*112;
    marks.push(graphic('line',{x1:22+(i%2)*34,y1:y,x2:410+(i%3)*61,y2:y+2,stroke:SOCIAL_POST_THEME.gold,strokeWidth:0.8,opacity:0.035}));
  }
  return element('svg',{
    display:'flex',position:'absolute',left:0,top:0,width:730,height:1024
  },marks,{viewBox:'0 0 730 1024',width:730,height:1024,'aria-hidden':'true'});
}

function createPremiumOverlay(){
  return element('svg',{
    display:'flex',position:'absolute',left:0,top:0,width:SOCIAL_POST_CARD.width,height:SOCIAL_POST_CARD.height
  },[
    graphic('path',{
      d:'M0 0 H834 C780 108 743 217 726 330 C700 500 708 677 771 828 C799 895 850 960 930 1024 H0 Z',
      fill:SOCIAL_POST_THEME.background,opacity:0.998
    }),
    graphic('path',{
      d:'M817 0 C761 116 725 228 710 344 C689 510 699 677 756 822 C782 889 827 954 902 1024 H842 C775 951 733 886 708 818 C657 678 649 513 670 352 C686 225 726 106 784 0 Z',
      fill:SOCIAL_POST_THEME.creamSecondary,opacity:0.965
    }),
    graphic('path',{
      d:'M848 -20 C791 101 754 222 738 344 C716 511 728 678 787 824 C816 895 864 963 944 1044',
      fill:'none',stroke:SOCIAL_POST_THEME.gold,strokeWidth:3.1,opacity:0.98
    }),
    graphic('path',{
      d:'M886 -22 C830 103 795 222 780 344 C760 511 773 675 830 816 C861 894 908 964 986 1046',
      fill:'none',stroke:SOCIAL_POST_THEME.petrolDeep,strokeWidth:10.5,opacity:0.97
    }),
    graphic('path',{
      d:'M908 -20 C852 106 818 225 803 346 C784 510 796 672 853 813 C884 891 932 962 1010 1046',
      fill:'none',stroke:SOCIAL_POST_THEME.goldLight,strokeWidth:2.2,opacity:0.96
    }),
    graphic('path',{
      d:'M938 -20 C884 110 852 229 838 350 C820 508 833 668 888 805 C919 884 966 953 1040 1045',
      fill:'none',stroke:SOCIAL_POST_THEME.goldPale,strokeWidth:1.15,opacity:0.74
    }),
    graphic('path',{
      d:'M820 645 C792 712 774 785 769 860 C827 846 883 824 935 798 C888 754 850 703 820 645 Z',
      fill:SOCIAL_POST_THEME.gold,opacity:0.74
    }),
    graphic('path',{
      d:'M823 650 C800 714 787 777 784 838 C828 826 869 811 908 791 C873 751 845 704 823 650 Z',
      fill:SOCIAL_POST_THEME.petrol,opacity:0.24
    }),
    graphic('path',{
      d:'M-78 306 C-18 322 22 375 22 447 C22 518-18 575-78 594',
      fill:'none',stroke:SOCIAL_POST_THEME.gold,strokeWidth:1.35,opacity:0.26
    }),
    graphic('circle',{cx:96,cy:782,r:5.5,fill:SOCIAL_POST_THEME.gold,opacity:0.72}),
    graphic('circle',{cx:119,cy:782,r:4.2,fill:SOCIAL_POST_THEME.gold,opacity:0.42}),
    graphic('circle',{cx:139,cy:782,r:3.1,fill:SOCIAL_POST_THEME.gold,opacity:0.23})
  ],{viewBox:'0 0 1536 1024',width:1536,height:1024,'aria-hidden':'true'});
}

function createOrnamentLine(labelWidth){
  const starX=SOCIAL_POST_CARD.label.left+labelWidth+36;
  return element('svg',{
    display:'flex',position:'absolute',left:0,top:0,width:1536,height:1024
  },[
    graphic('polygon',{points:`${starX},153 ${starX+4},168 ${starX+19},172 ${starX+4},176 ${starX},191 ${starX-4},176 ${starX-19},172 ${starX-4},168`,fill:SOCIAL_POST_THEME.gold,opacity:0.94}),
    graphic('line',{x1:starX+34,y1:172,x2:656,y2:172,stroke:SOCIAL_POST_THEME.gold,strokeWidth:2,opacity:0.84}),
    graphic('line',{x1:starX+34,y1:178,x2:600,y2:178,stroke:SOCIAL_POST_THEME.goldPale,strokeWidth:0.8,opacity:0.58})
  ],{viewBox:'0 0 1536 1024',width:1536,height:1024,'aria-hidden':'true'});
}

function createCornerSignature(){
  return element('svg',{
    display:'flex',position:'absolute',right:32,bottom:25,width:136,height:34
  },[
    graphic('line',{x1:0,y1:26,x2:136,y2:26,stroke:SOCIAL_POST_THEME.gold,strokeWidth:5,strokeLinecap:'round',opacity:0.72}),
    graphic('line',{x1:52,y1:12,x2:136,y2:12,stroke:SOCIAL_POST_THEME.petrol,strokeWidth:3.5,strokeLinecap:'round',opacity:0.76}),
    graphic('circle',{cx:36,cy:12,r:3.2,fill:SOCIAL_POST_THEME.gold,opacity:0.72})
  ],{viewBox:'0 0 136 34',width:136,height:34,'aria-hidden':'true'});
}

export function createSocialPostLayout({title,badge='GUIA',image,pillar='casa'}){
  if (!image) throw new Error('base image is required');
  const exactBadge=normalizeBadge(badge);
  const exactPillar=normalizePillar(pillar);
  const titleLayout=selectSocialPostTitleLayout(title);
  const labelWidth=badgeWidth(exactBadge);

  const tree=element('div',{
    display:'flex',position:'relative',width:SOCIAL_POST_CARD.width,height:SOCIAL_POST_CARD.height,
    overflow:'hidden',backgroundColor:SOCIAL_POST_THEME.background
  },[
    element('img',{
      position:'absolute',left:0,top:0,width:SOCIAL_POST_CARD.width,height:SOCIAL_POST_CARD.height,
      objectFit:'cover',objectPosition:'64% center'
    },null,{src:image,width:SOCIAL_POST_CARD.width,height:SOCIAL_POST_CARD.height}),
    createPremiumOverlay(),
    createPaperTexture(),
    createWatermark(exactPillar),
    element('div',{
      display:'flex',position:'absolute',left:SOCIAL_POST_CARD.label.left,top:SOCIAL_POST_CARD.label.top,
      width:labelWidth,height:SOCIAL_POST_CARD.label.height,borderRadius:34,
      alignItems:'center',justifyContent:'center',backgroundColor:SOCIAL_POST_THEME.petrol,
      color:SOCIAL_POST_THEME.goldLight,border:`2px solid ${SOCIAL_POST_THEME.gold}`,
      fontFamily:'Lato',fontWeight:700,fontSize:26,letterSpacing:exactBadge.length>12?2.2:4.4,
      paddingLeft:24,paddingRight:24
    },exactBadge),
    element('div',{
      display:'flex',position:'absolute',
      left:SOCIAL_POST_CARD.label.left+10,top:SOCIAL_POST_CARD.label.top+10,
      width:labelWidth-20,height:SOCIAL_POST_CARD.label.height-20,borderRadius:26,
      border:`1px solid ${SOCIAL_POST_THEME.goldPale}`,opacity:0.22
    },null),
    createOrnamentLine(labelWidth),
    element('div',{
      display:'flex',position:'absolute',left:SOCIAL_POST_CARD.title.left,top:SOCIAL_POST_CARD.title.top,
      width:SOCIAL_POST_CARD.title.width,height:titleLayout.height,flexDirection:'column',
      color:SOCIAL_POST_THEME.ink,fontFamily:'Cormorant Garamond',fontWeight:500,
      fontSize:titleLayout.fontSize,lineHeight:1,letterSpacing:-0.7
    },titleLayout.lines.map((line,index)=>element('div',{
      display:'flex',width:SOCIAL_POST_CARD.title.width,height:titleLayout.lineHeight,alignItems:'center'
    },line,{key:`social-title-${index}`}))),
    element('div',{
      display:'flex',position:'absolute',left:76,top:773,width:208,height:2,
      backgroundColor:SOCIAL_POST_THEME.gold,opacity:0.72
    },null),
    createHouseFooterIcon(),
    element('div',{
      display:'flex',position:'absolute',left:120,top:846,width:352,height:2,
      backgroundColor:SOCIAL_POST_THEME.gold,opacity:0.88
    },null),
    element('div',{
      display:'flex',position:'absolute',left:SOCIAL_POST_CARD.brand.left,top:SOCIAL_POST_CARD.brand.top,
      width:SOCIAL_POST_CARD.brand.width,height:SOCIAL_POST_CARD.brand.height,alignItems:'center',
      color:SOCIAL_POST_THEME.ink,fontFamily:'Cormorant Garamond',fontWeight:500,fontSize:34,
      letterSpacing:0.25
    },'Guia do Proprietário'),
    element('div',{
      display:'flex',position:'absolute',left:76,top:954,width:152,height:1,
      backgroundColor:SOCIAL_POST_THEME.goldLight,opacity:0.55
    },null),
    createCornerSignature()
  ],{lang:'pt-PT'});

  return {
    tree,
    metrics:{
      variant:'social',
      design:'premium-editorial-v3',
      badge:exactBadge,
      pillar:exactPillar,
      title:{...SOCIAL_POST_CARD.title,...titleLayout,bottom:SOCIAL_POST_CARD.title.top+titleLayout.height},
      label:{...SOCIAL_POST_CARD.label,width:labelWidth,border:true,goldText:true,doubleRule:true},
      image:{...SOCIAL_POST_CARD.image,fullCanvas:true,focus:'64% center'},
      curve:{...SOCIAL_POST_CARD.curve,layered:true,gold:true,petrol:true,contours:4},
      watermark:{...SOCIAL_POST_CARD.watermark,pillar:exactPillar},
      footer:{...SOCIAL_POST_CARD.footer,houseIcon:true,goldRule:true,signature:true},
      textSafeRight:SOCIAL_POST_CARD.textSafeRight,
      exactSource:'',
      source:null
    }
  };
}
