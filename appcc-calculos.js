/* Motor compartilhado pelo PDF e pelo preenchimento do PDF no navegador. */
function AppccCalculate(config, values) {
 var output={}, disabled={}, results=[], activeSources={},mirrored={},weights={PCC:40,PC:25,PPR:15,PPRO:12,PPHO:8};
 function raw(n){return values[n]==null?'':String(values[n]);}
 function answer(n){var v=raw(n).replace(/^\//,'').toUpperCase();return v==='SIM'||v==='S'?'SIM':v==='NÃO'||v==='NAO'||v==='N'?'NÃO':v==='NA'||v==='NÃO APLICÁVEL'?'NA':'';}
 function number(v){var s=String(v).trim().replace(/\s/g,'').replace('%','');if(s.indexOf(',')>=0)s=s.replace(/\./g,'').replace(',','.');var n=Number(s);return s!==''&&isFinite(n)?n:null;}
 function risk(code,pc){return pc===null?'Pendente':config.strict.indexOf(code)>=0?(pc===100?'Baixo':pc>=76?'Médio':'Alto'):(pc>=76?'Baixo':pc>=51?'Médio':'Alto');}
 function maxRisk(rs){if(rs.indexOf('Alto')>=0)return 'Alto';if(rs.indexOf('Pendente')>=0||rs.indexOf('Não avaliado')>=0)return 'Pendente';if(rs.indexOf('Médio')>=0)return 'Médio';if(rs.indexOf('Baixo')>=0)return 'Baixo';return 'Não aplicável';}
 for(var mi=0;mi<config.mirrors.length;mi++){values[config.mirrors[mi].target]=raw(config.mirrors[mi].source);mirrored[config.mirrors[mi].target]=true;}
 for(var gi=0;gi<config.groups.length;gi++){
  var g=config.groups[gi], used=false, pending=false, items=[], blocks={},custom=false;
  for(var mi=0;mi<g.metadata.length;mi++)if(!mirrored[g.metadata[mi]]&&raw(g.metadata[mi])&&raw(g.metadata[mi])!=='Off'&&raw(g.metadata[mi])!=='/Off')used=true;
  for(var ii=0;ii<g.items.length;ii++){
   var item=g.items[ii],v=answer(item.answer),cl=raw(item.classField),classes=cl&&cl!=='Por frase'&&cl.indexOf('Original:')!==0?[cl]:item.classes;
   if(v)used=true;if(v==='NA')continue;if(!v)pending=true;
   var unique=[];for(var ci=0;ci<classes.length;ci++)if(unique.indexOf(classes[ci])<0)unique.push(classes[ci]);
   var weight=number(raw(item.weightField));if(weight!==null)custom=true;
   var record={v:v,classes:unique,weight:weight};items.push(record);
   for(var ci=0;ci<unique.length;ci++){var cls=unique[ci];if(!blocks[cls])blocks[cls]=[];blocks[cls].push(v==='SIM');}
  }
  var pc=null,r='Não avaliado';
  if(used)for(var ai=0;ai<g.items.length;ai++)activeSources[g.items[ai].answer]=true;
  if(used){
   if(!items.length)r='Não aplicável';
   else if(pending)r='Pendente';
   else{
    var earned=0,total=0,all={};
    for(var cls in blocks){var ok=true;for(var j=0;j<blocks[cls].length;j++)if(!blocks[cls][j])ok=false;all[cls]=ok;}
    for(var j=0;j<items.length;j++){
     var item=items[j],w=0,got=0;
     for(var k=0;k<item.classes.length;k++){
      var cls=item.classes[k],part=(weights[cls]||0)/blocks[cls].length;
      w+=part;got+=part*((cls==='PCC'||cls==='PC')?all[cls]:item.v==='SIM');
     }
     if(custom&&item.weight!==null){w=Math.max(0,Math.min(100,item.weight));var satisfied=item.v==='SIM';for(var k=0;k<item.classes.length;k++)if((item.classes[k]==='PCC'||item.classes[k]==='PC')&&!all[item.classes[k]])satisfied=false;got=satisfied?w:0;}
     total+=w;earned+=got;
    }
    pc=total?Math.round(1000*earned/total)/10:null;r=risk(g.proc,pc);
   }
  }
  output[g.percent]=pc===null?'':String(pc).replace('.',',')+'%';output[g.risk]=used?r:'';
  results.push({group:g,pc:pc,risk:r,used:used});
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
 return {values:output,disabled:disabled,groups:results,risk:plant};
}
if(typeof module!=='undefined'&&module.exports)module.exports=AppccCalculate;
