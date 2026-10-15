/* Motor compartilhado pelo PDF e pelo preenchimento do PDF no navegador. */
function AppccCalculate(config, values) {
 var output={}, disabled={}, results=[], activeSources={},mirrored={},weights={PCC:40,PC:25,PPR:15,PPRO:12,PPHO:8};
 function raw(n){return values[n]==null?'':String(values[n]);}
 function answer(n){var v=raw(n).replace(/^\//,'').toUpperCase();return v==='SIM'||v==='S'?'SIM':v==='NÃO'||v==='NAO'||v==='N'?'NÃO':v==='NA'||v==='NÃO APLICÁVEL'?'NA':'';}
 function number(v){var s=String(v).trim().replace(/\s/g,'').replace('%','');if(s.indexOf(',')>=0)s=s.replace(/\./g,'').replace(',','.');var n=Number(s);return s!==''&&isFinite(n)?n:null;}
 function risk(code,pc){return pc===null?'Pendente':config.strict.indexOf(code)>=0?(pc===100?'Baixo':pc>=76?'Médio':'Alto'):(pc>=76?'Baixo':pc>50?'Médio':'Alto');}
 function maxRisk(rs){if(rs.indexOf('Alto')>=0)return 'Alto';if(rs.indexOf('Pendente')>=0||rs.indexOf('Não avaliado')>=0)return 'Pendente';if(rs.indexOf('Médio')>=0)return 'Médio';if(rs.indexOf('Baixo')>=0)return 'Baixo';return 'Não aplicável';}
 for(var mi=0;mi<config.mirrors.length;mi++){values[config.mirrors[mi].target]=raw(config.mirrors[mi].source);mirrored[config.mirrors[mi].target]=true;}
 for(var gi=0;gi<config.groups.length;gi++){
  var g=config.groups[gi],used=false,pending=false,items=[];
  for(var mi=0;mi<g.metadata.length;mi++)if(!mirrored[g.metadata[mi]]&&raw(g.metadata[mi])&&raw(g.metadata[mi])!=='Off'&&raw(g.metadata[mi])!=='/Off')used=true;
  for(var ii=0;ii<g.items.length;ii++){
   var item=g.items[ii],v=answer(item.answer),cl=raw(item.classField),classes=cl&&cl!=='Por frase'&&cl.indexOf('Original:')!==0?[cl]:item.classes;
   var nc=0;for(var ci=0;ci<classes.length;ci++)nc=Math.max(nc,(config.ncLevels||{PC:1,PPR:2,PPHO:3,PPRO:4,PCC:5})[classes[ci]]||0);
   var prob=number(raw(item.probabilityField)),valid=prob!==null&&prob>=1&&prob<=5&&Math.floor(prob)===prob;
   disabled[item.answer]=true;var phraseRows=[];try{phraseRows=JSON.parse(raw(item.phraseField)||'[]');}catch(e){}
   var phraseScore=null,hasPhrase=false,phrasePending=false,anyNo=false,allNA=true;
   hasPhrase=phraseRows.length>0;
   if(hasPhrase){
    var scored=[];
    for(var fj=0;fj<item.phrases.length;fj++){
     var def=item.phrases[fj],fr=phraseRows[fj]||{},fv=fr.v||'';
     if(fv==='NA'&&def.na)continue;allNA=false;if(fv==='NÃO')anyNo=true;
     var fp=fr.p===undefined||fr.p===''?prob:number(fr.p),fnc=(config.ncLevels||{})[def.cls]||0;
     if(!fv||fp===null||fp<1||fp>5||Math.floor(fp)!==fp)phrasePending=true;
     scored.push({v:fv,w:fnc*(fp||0),nc:fnc});
    }
    v=allNA?'NA':anyNo?'NÃO':phrasePending?'':'SIM';
    phraseScore=0;var phraseNC=nc;for(var fj=0;fj<scored.length;fj++)if(scored[fj].v===(v==='NÃO'?'NÃO':'SIM')&&scored[fj].w>=phraseScore){phraseScore=scored[fj].w;phraseNC=scored[fj].nc;}
    values[item.answer]=v;output[item.answer]=v;
   }

   output[item.ncField]=String(nc);if(item.unitNcField)output[item.unitNcField]=hasPhrase?String(phraseNC):String(nc);output[item.weightField]=valid?String(nc*prob):'';
   if(v)used=true;if(v==='NA')continue;
   if(!v||(hasPhrase?phrasePending:!valid))pending=true;items.push({v:v,w:hasPhrase?phraseScore:valid?nc*prob:0});
  }
  var pc=null,r='Não avaliado';
  if(used)for(var ai=0;ai<g.items.length;ai++)activeSources[g.items[ai].answer]=true;
  if(used){if(!items.length)r='Não aplicável';else if(pending)r='Pendente';else{var earned=0,total=0;for(var j=0;j<items.length;j++){total+=items[j].w;if(items[j].v==='SIM')earned+=items[j].w;}pc=total?Math.round(1000*earned/total)/10:null;r=risk(g.proc,pc);}}
  output[g.percent]=pc===null?'':String(pc).replace('.',',')+'%';output[g.risk]=used?r:'';results.push({group:g,pc:pc,risk:r,used:used});
 }

 for(var i=0;i<config.rows.length;i++){
  var row=config.rows[i],v='',has=false,missing=false,active=false;
  for(var j=0;j<row.sources.length;j++){if(!activeSources[row.sources[j]])continue;active=true;var a=answer(row.sources[j]);if(a==='NÃO'){v='NÃO';break;}if(!a)missing=true;else if(a==='SIM')has=true;}
  if(!v)v=!active?'':missing?'Pendente':has?'SIM':'NA';output[row.result]=v;
 }
 for(var page in config.pages){
  var indexes=config.pages[page],rs=[],pcs=[];
  for(var j=0;j<indexes.length;j++){var r=results[indexes[j]];if(r.used){rs.push(r.risk);if(r.pc!==null)pcs.push(r.pc);}}
  output['p'+page+'_risk_result']=rs.length?maxRisk(rs):'Não avaliado';output['p'+page+'_percent_result']=pcs.length&&rs.indexOf('Pendente')<0?String(Math.min.apply(Math,pcs)).replace('.',',')+'%':'';
 }
 var plantRisks=[];
 for(var pi=0;pi<config.processes.length;pi++){
  var code=config.processes[pi],rs=[],list=[];
  for(var j=0;j<results.length;j++){var result=results[j];if(result.group.proc===code&&result.used){rs.push(result.risk);list.push(result);}}
  var procRisk=rs.length?maxRisk(rs):'Não avaliado';plantRisks.push(procRisk);output['p18_risco_'+(pi+1)]=procRisk;
  for(var j=0;j<16;j++)output['p18_linha_'+(pi+1)+'_'+(j+1)]=list[j]?(list[j].group.label+': '+(list[j].risk==='Não aplicável'?'NA':list[j].risk)):'';
 }
 var plant=maxRisk(plantRisks),n=plant==='Baixo'?1:plant==='Médio'?2:plant==='Alto'?3:0;
 output.p18_risco_estabelecimento=plant;output.p19_classificacao=n?'Grupo'+n:'Off';output.p19_classificacao_automatica=n?'Grupo '+n+' - Estabelecimento de '+plant+' Risco':'Classificação: '+plant;
 var sum=0,count=0;
 for(var j=0;j<config.flows.length;j++){var value=number(raw(config.flows[j]));if(value!==null&&value>=0){sum+=value;count++;}}
 output.p1_vazao_total=count?String(Math.round(sum*1000)/1000).replace('.',','):'';
 for(var j=0;j<8;j++){var field='legal_'+j+'_atende';disabled[field]=raw('legal_'+j+'_situacao')!=='Entregue';if(disabled[field])output[field]='Off';}
 for(var j=0;j<config.mirrors.length;j++){var mirror=config.mirrors[j];output[mirror.target]=raw(mirror.source);}

 for(var pn in (config.phraseNotesFields||{})){
  var noteFields=config.phraseNotesFields[pn],notes=[];
  for(var ng=0;ng<config.groups.length;ng++)if(config.groups[ng].page===Number(pn)){
   var group=config.groups[ng];
   for(var ni=0;ni<group.items.length;ni++){
    var it=group.items[ni],prs=[];try{prs=JSON.parse(raw(it.phraseField)||'[]');}catch(e){}
    for(var nj=0;nj<prs.length;nj++)if(prs[nj]&&String(prs[nj].obs||'').replace(/\s/g,''))notes.push('Indicador '+it.serial+' / grupo '+group.label+' / frase '+(nj+1)+': '+prs[nj].obs);
   }
  }
  if(noteFields.length){var field=noteFields[0],manual=raw(field).split('\n\n[OBSERVAÇÕES POR FRASE]')[0];output[field]=manual+(notes.length?'\n\n[OBSERVAÇÕES POR FRASE]\n'+notes.join('\n\n'):'');}
 }
 return {values:output,disabled:disabled,groups:results,risk:plant};
}
if(typeof module!=='undefined'&&module.exports)module.exports=AppccCalculate;
