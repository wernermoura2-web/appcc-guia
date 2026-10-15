/* PDF de 22 páginas: edição local, cálculo compartilhado e exportação AcroForm. */
(function(){
 'use strict';
 const key='appcc-pdf-revisao-v1',version=18;
 let metadata,bytes,templateBytes,documentPDF,pdfjs,renderTask,values={},photos={},pageNo=1,renderSerial=0,busy=false;
 const byId=id=>document.getElementById(id),msg=t=>byId('pdfStatus').textContent=t;
 const titles=['Captação','Condução','Reservatórios da captação 1','Reservatórios da captação 2','Reservatórios da captação 3','Reservatórios da captação 4','Recepção','Higienização de retornáveis','Higienização de descartáveis','Envase de retornáveis','Envase de descartáveis','Controle de qualidade','Responsabilidade','Observações gerais','Documentos legais','Fotos','Fotos — continuação','Matriz de risco','Ações e responsáveis','Rótulos','Rótulos — continuação','Rótulos — continuação'];
 const download=(name,data,type)=>{const u=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),30000);};
 function persist(){try{localStorage.setItem(key,JSON.stringify({format:'guia-appcc-pdf',version,values,photos}));msg('Preenchimento salvo neste aparelho. Guarde uma cópia em JSON ou PDF.');}catch(e){msg('O preenchimento está aberto, mas a memória local está cheia. Use Salvar JSON para guardar sua cópia.');}}
 function update(name,value){
  if(name){values[name]=value;for(const g of metadata.config.groups)for(const i of g.items)if(i.answer===name)values[i.phraseField]=JSON.stringify(i.phrases.map(f=>({v:value==='NA'&&!f.na?'':value})));for(const links of Object.values(metadata.config.classes))for(const pair of links)for(let k=0;k<2;k++)if(pair[k]===name)for(const other of links)values[other[k]]=value;}
  const result=AppccCalculate(metadata.config,values);Object.assign(values,result.values);
  for(const el of byId('pdfFields').querySelectorAll('[data-field]')){
   const n=el.dataset.field,v=String(values[n]||'').replace(/^\//,'');
   if(el.type==='radio')el.checked=(v==='NÃO'?'NAO':v)===el.value;
   else if(el.tagName==='INPUT'||el.tagName==='TEXTAREA'||el.tagName==='SELECT'){if(document.activeElement!==el)el.value=v;}
   el.disabled=!!result.disabled[n]||metadata.derived.includes(n);if(el.type==='radio'&&metadata.derived.includes(n))el.classList.add('pdf-derived-answer');
   if(metadata.derived.includes(n)&&el.type!=='radio'){const r=el.getBoundingClientRect();el.style.fontSize=Math.min(12,r.height*.7,(r.width-2)*1.7/Math.max(1,v.length))+'px';}
   el.classList.toggle('risk-high',v==='Alto');el.classList.toggle('risk-med',v==='Médio');el.classList.toggle('risk-low',v==='Baixo');
  }
  byId('pdfGlobalRisk').textContent='Risco do estabelecimento: '+result.risk;
 }
 function label(n){
  for(const g of metadata.config.groups)for(const i of g.items){if(i.answer===n)return 'Indicador '+i.serial+' — '+titles[g.page-1]+' — grupo '+g.label;if(i.classField===n)return 'APPCC do indicador '+i.serial;if(i.weightField===n)return 'NC × P do indicador '+i.serial;if(i.probabilityField===n)return 'Probabilidade (1 a 5) do indicador '+i.serial;if(i.ncField===n)return 'Criticidade do indicador '+i.serial;if(i.unitNcField===n)return 'NC do indicador '+i.serial+' — grupo '+g.label;}
  const names={identificacao_ENVASADORA:'Envasadora',identificacao_ENDEREÇO:'Endereço',identificacao_DATA:'Data',p1_vazao_total:'Vazão total das captações',p18_risco_estabelecimento:'Risco do estabelecimento',p19_classificacao:'Classificação automática',p19_classificacao_automatica:'Grupo do estabelecimento'};
  if(names[n])return names[n];
  if(/^p1_fonte_/.test(n))return 'Fonte da captação '+n.split('_').pop();
  if(/^p1_identificacao_3_/.test(n))return 'Vazão da captação '+(Number(n.split('_').pop())+1)+' (m³/h)';
  if(/^p1_identificacao_1_/.test(n))return 'Nome da captação '+(Number(n.split('_').pop())+1);
  if(/^legal_/.test(n)){const parts=n.split('_');return 'Documento '+(Number(parts[1])+1)+' — '+({situacao:'Situação',atende:'Atende ao descritor?',observacao:'Observação'}[parts[2]]||'');}
  if(/observac|considerac|medidas|fiscalizacao|envasadora/.test(n))return n.replace(/^p\d+_/,'').replace(/_/g,' ');
  return n.replace(/^p\d+_/,'').replace(/_/g,' ');
 }
 function position(el,r,page){el.style.left=(r[0]/page.width*100)+'%';el.style.top=((page.height-r[3])/page.height*100)+'%';el.style.width=((r[2]-r[0])/page.width*100)+'%';el.style.height=((r[3]-r[1])/page.height*100)+'%';}
 async function render(){
  const serial=++renderSerial,pg=await documentPDF.getPage(pageNo),vp=pg.getViewport({scale:1});if(serial!==renderSerial)return;
  if(renderTask)renderTask.cancel();
  byId('pdfPage').value=String(pageNo);byId('pdfPageTitle').textContent='Página '+pageNo+' de 22 — '+titles[pageNo-1];
  const paper=byId('pdfPaper'),canvas=byId('pdfCanvas'),width=paper.clientWidth||750,scale=width/vp.width,dpr=Math.min(devicePixelRatio||1,1.5),v=pg.getViewport({scale:scale*dpr});
  canvas.width=Math.ceil(v.width);canvas.height=Math.ceil(v.height);paper.style.setProperty('--pdf-scale',String(scale));
  const ctx=canvas.getContext('2d');const task=pg.render({canvasContext:ctx,viewport:v});renderTask=task;try{await task.promise;}catch(e){if(e.name==='RenderingCancelledException')return;throw e;}if(renderTask===task)renderTask=null;if(serial!==renderSerial)return;
  const layer=byId('pdfFields');layer.replaceChildren();
  for(const widget of metadata.widgets.filter(w=>w.page===pageNo)){
   const n=widget.name,flags=widget.flags,rect=widget.rect,media=metadata.config.media.find(m=>m.name===n);
   if(media){const control=mediaControl(media);position(control,rect,vp);layer.append(control);continue;}if(widget.phraseAnswer){const control=document.createElement('button');control.type='button';control.textContent='F';control.title=widget.label;control.onclick=()=>editPhrases(widget.phraseAnswer);position(control,rect,vp);control.style.position='absolute';control.style.padding='0';control.style.fontSize='calc(var(--pdf-scale) * 5px)';control.style.minHeight='0';control.style.minWidth='0';control.style.maxHeight='none';control.style.margin='0';control.style.lineHeight='1';control.style.boxSizing='border-box';control.style.borderRadius='1px';control.style.border='1px solid #63869b';control.style.overflow='hidden';control.setAttribute('aria-label',widget.label);layer.append(control);continue;}
   let el;
   if(widget.type==='/Btn'){el=document.createElement('input');el.type='radio';el.name=n;el.value=widget.radio;el.setAttribute('aria-label',label(n)+' — '+({'NAO':'NÃO','POCO':'Poço','SURGENCIA':'Surgência'}[widget.radio]||widget.radio));}
    else if(widget.type==='/Ch'){el=document.createElement('select');for(const option of widget.options){const o=document.createElement('option');o.value=option;o.textContent=option;if(option==='Por frase'){const classes=[];for(const g of metadata.config.groups)for(const item of g.items)if(item.classField===n)for(const cls of item.classes)if(!classes.includes(cls))classes.push(cls);o.textContent=classes.join('/');}el.append(o);}}
   else{el=document.createElement(flags&4096?'textarea':'input');if(el.tagName==='INPUT')el.type='text';el.setAttribute('aria-label',label(n));if(/_probabilidade$/.test(n)){el.type='number';el.min='1';el.max='5';el.step='1';el.placeholder='P';}if(/_criticidade$/.test(n))el.title='Criticidade NC';if(n==='identificacao_DATA')el.placeholder='dd/mm/aaaa';}
   if(!el.hasAttribute('aria-label'))el.setAttribute('aria-label',label(n));el.title=el.getAttribute('aria-label');el.classList.add('pdf-field');el.dataset.field=n;
   el.style.fontSize='calc(var(--pdf-scale) * '+Math.min(8,(rect[3]-rect[1])*.65)+'px)';position(el,rect,vp);
   el.addEventListener(el.type==='radio'||el.tagName==='SELECT'?'change':'input',()=>{if(/_probabilidade$/.test(n)&&el.value!==''&&(!Number.isFinite(Number(el.value.replace(',','.')))||!Number.isInteger(Number(el.value))||Number(el.value)<1||Number(el.value)>5)){el.setCustomValidity('Use probabilidade inteira de 1 a 5.');el.reportValidity();return;}el.setCustomValidity('');update(n,el.value);persist();});layer.append(el);
  }
  update();byId('pdfPrevious').disabled=pageNo===1;byId('pdfNext').disabled=pageNo===22;
 }
 function editPhrases(answerName){
 const group=metadata.config.groups.find(g=>g.items.some(i=>i.answer===answerName)),item=group?.items.find(i=>i.answer===answerName);if(!item)return;
 let rows=[];try{rows=JSON.parse(values[item.phraseField]||'[]');}catch(e){}
 const dialog=document.createElement('dialog');dialog.className='appcc-phrase-sheet';dialog.setAttribute('aria-label','Avaliação das frases do indicador '+item.serial);
 const header=document.createElement('header'),title=document.createElement('h2');title.textContent='INDICADOR '+item.serial+' — AVALIAÇÃO DAS FRASES';header.append(title);dialog.append(header);
 const location=document.createElement('p');location.className='phrase-location';location.textContent=titles[group.page-1]+' · Grupo '+group.label;dialog.append(location);
 const rule=document.createElement('p');rule.className='phrase-rule';rule.textContent='NC: PC=1; PPR=2; PPHO=3; PPRO=4; PCC=5. P da frase: <20%=1; 20 a <40%=2; 40 a <60%=3; 60 a 75%=4; >75%=5. Pontuação = NC × P.';dialog.append(rule);
 const cards=document.createElement('div');cards.className='phrase-cards';dialog.append(cards);const controls=[];
 const summary=document.createElement('p');summary.className='phrase-summary';summary.setAttribute('role','status');
 function snapshot(){return controls.map(c=>({v:c.answer.value,p:c.probability.value,obs:c.observation.value}));}
 function storeDraft(recalculate=true){
  if(controls.some(c=>!c.probability.checkValidity()))return false;
  values[item.phraseField]=JSON.stringify(snapshot());
  if(recalculate)update();persist();
  for(const c of controls)c.product.value=String(metadata.config.ncLevels[c.cls]*(Number(c.probability.value)||Number(values[item.probabilityField])||0));
  const state=AppccCalculate(metadata.config,{...values}).values[item.answer];summary.textContent=state==='SIM'?'Resultado do indicador: SIM':state==='NÃO'?'Resultado do indicador: NÃO':state==='NA'?'Resultado do indicador: NÃO APLICÁVEL':'Item pendente: avalie todas as frases aplicáveis.';return true;
 }
 for(const [j,f] of item.phrases.entries()){
  const card=document.createElement('section');card.className='phrase-card';const requirement=document.createElement('p');requirement.className='phrase-requirement';requirement.textContent=(j+1)+'. '+f.text;card.append(requirement);
  const bar=document.createElement('div');bar.className='phrase-bar';
  function field(labelText,value,readOnly){const label=document.createElement('label');label.textContent=labelText;const input=document.createElement('input');input.type='text';input.value=value;input.readOnly=readOnly;input.setAttribute('aria-label',labelText+' da frase '+(j+1));label.append(input);bar.append(label);return input;}
  field('APPCC',f.cls,true);field('NC',String(metadata.config.ncLevels[f.cls]),true);
  const probability=field('P',String(rows[j]?.p||values[item.probabilityField]||''),false);probability.type='number';probability.min='1';probability.max='5';probability.step='1';probability.required=true;probability.setAttribute('aria-label','Probabilidade da frase '+(j+1));
  const product=field('NC × P',String(metadata.config.ncLevels[f.cls]*(Number(probability.value)||0)),true);
  const answers=document.createElement('fieldset');answers.className='phrase-answers';const legend=document.createElement('legend');legend.textContent='Resposta da frase '+(j+1);answers.append(legend);const answer={value:rows[j]?.v||''};
  for(const [value,text] of [['SIM','Sim'],['NÃO','Não'],...(f.na?[['NA','NA']]:[])]){const label=document.createElement('label'),radio=document.createElement('input');radio.type='radio';radio.name='phrase-'+answerName+'-'+j;radio.value=value;radio.checked=answer.value===value;radio.setAttribute('aria-label',text+' — frase '+(j+1));radio.onchange=()=>{answer.value=value;storeDraft();};label.append(radio,document.createTextNode(text));answers.append(label);}
  bar.append(answers);card.append(bar);
  const obslabel=document.createElement('label');obslabel.className='phrase-observation';obslabel.textContent='Observações da frase '+(j+1);const observation=document.createElement('textarea');observation.rows=3;observation.value=rows[j]?.obs||'';observation.setAttribute('aria-label','Observações da frase '+(j+1));observation.oninput=()=>storeDraft(false);observation.onchange=()=>storeDraft();obslabel.append(observation);card.append(obslabel);cards.append(card);
  controls.push({answer,probability,observation,product,cls:f.cls});probability.onchange=()=>{if(!probability.checkValidity()){probability.reportValidity();return;}storeDraft();};
 }
 dialog.append(summary);const footer=document.createElement('footer');footer.className='phrase-footer';const keep=document.createElement('button');keep.type='button';keep.textContent='Guardar alterações';keep.onclick=()=>{if(storeDraft())summary.textContent+=' · Alterações guardadas.';};const back=document.createElement('button');back.type='button';back.textContent='Salvar e voltar ao processo';back.onclick=()=>{if(!storeDraft()){dialog.querySelector('input:invalid')?.reportValidity();return;}dialog.close();dialog.remove();};footer.append(keep,back);dialog.append(footer);
 dialog.addEventListener('cancel',e=>{e.preventDefault();back.click();});document.body.append(dialog);dialog.showModal();
 const state=values[item.answer];summary.textContent=state==='SIM'?'Resultado do indicador: SIM':state==='NÃO'?'Resultado do indicador: NÃO':'Item pendente: avalie todas as frases aplicáveis.';
 }
 async function convertImage(file,rotation=0){
  if(!file||file.size>20*1024*1024||!/^image\/(jpeg|png|webp)$/.test(file.type))throw Error('Escolha uma imagem JPG, PNG ou WebP de até 20 MB.');
  const bmp=await createImageBitmap(file),c=document.createElement('canvas'),swap=rotation%180!==0,w=swap?bmp.height:bmp.width,h=swap?bmp.width:bmp.height,s=Math.min(1,1600/Math.max(w,h));c.width=Math.round(w*s);c.height=Math.round(h*s);const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.translate(c.width/2,c.height/2);ctx.rotate(rotation*Math.PI/180);ctx.drawImage(bmp,-bmp.width*s/2,-bmp.height*s/2,bmp.width*s,bmp.height*s);bmp.close();return c.toDataURL('image/jpeg',.83);
 }
 function mediaControl(media){
  const box=document.createElement('div');box.className='pdf-media';const data=photos[media.name];
  if(data){const image=document.createElement('img');image.src=data;image.alt=media.kind+' '+media.index;box.append(image);}
  const buttons=document.createElement('div');buttons.className='pdf-media-actions';
  const add=document.createElement('button');add.type='button';add.textContent=data?'Trocar':'+ Imagem';add.setAttribute('aria-label','Adicionar '+media.kind+' '+media.index);
  const input=document.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp';input.hidden=true;input.setAttribute('aria-label','Arquivo da '+media.kind+' '+media.index);add.addEventListener('click',()=>input.click());
  input.addEventListener('change',async()=>{try{if(!input.files[0])return;photos[media.name]=await convertImage(input.files[0]);persist();await render();}catch(e){msg(e.message);}finally{input.value='';}});buttons.append(add,input);
  if(data){const rotate=document.createElement('button');rotate.type='button';rotate.textContent='↻ 90°';rotate.setAttribute('aria-label','Girar '+media.kind+' '+media.index+' 90 graus');rotate.addEventListener('click',async()=>{try{photos[media.name]=await convertImage(await(await fetch(data)).blob(),90);persist();await render();}catch(e){msg(e.message);}});buttons.append(rotate);}
  const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Remover '+media.kind+' '+media.index);remove.addEventListener('click',async()=>{photos[media.name]=null;persist();await render();});buttons.append(remove);box.append(buttons);return box;
 }
 async function open(){
  if(busy)return;busy=true;byId('pdfEditor').hidden=false;byId('pdfEditor').inert=true;msg('Abrindo o PDF editável…');
  try{
   if(!metadata){
    const [meta,pdf,library]=await Promise.all([fetch('./pdf-appcc-campos.json?v=18').then(r=>{if(!r.ok)throw Error('Não foi possível abrir os campos do PDF.');return r.json();}),fetch('./Guia_APPCC_22_Paginas.pdf?v=18').then(r=>{if(!r.ok)throw Error('Não foi possível abrir o PDF.');return r.arrayBuffer();}),import('./pdfjs-appcc.mjs?v=18')]);
    metadata=meta;bytes=new Uint8Array(pdf);templateBytes=bytes.slice();pdfjs=library;pdfjs.GlobalWorkerOptions.workerSrc='./pdfjs-appcc.worker.mjs?v=18';values={...meta.defaults};
    try{const saved=JSON.parse(localStorage.getItem(key));if(saved?.format==='guia-appcc-pdf'&&[14,15,16,17,version].includes(saved.version)){for(const n of Object.keys(values))if(typeof saved.values?.[n]==='string')values[n]=saved.values[n];photos=validPhotos(saved.photos);}}catch(e){}
    documentPDF=await pdfjs.getDocument({data:bytes.slice(),isEvalSupported:false}).promise;update();
    byId('pdfPage').replaceChildren(...titles.map((t,i)=>{const o=document.createElement('option');o.value=String(i+1);o.textContent=(i+1)+' · '+t;return o;}));
   }
   await render();msg('PDF editável aberto. Respostas, criticidade e probabilidade calculam os resultados. Use F para avaliar as frases; os valores de probabilidade definidos já estão incluídos.');byId('pdfEditor').scrollIntoView({block:'start'});
  }catch(e){console.error(e);msg('Não foi possível abrir o PDF. Mantenha a internet e toque em Abrir PDF do guia novamente.');}finally{busy=false;byId('pdfEditor').inert=false;}
 }
 function iconFingerprint(button){
  let hash=2166136261;const visited=new Set(),feed=data=>{for(const n of data)hash=Math.imul(hash^n,16777619);};
  function walk(stream,depth){if(!stream||depth>6||visited.has(stream))return;visited.add(stream);let data;
   if(stream.getUnencodedContents)data=stream.getUnencodedContents();else if(stream instanceof PDFLib.PDFRawStream){try{data=PDFLib.decodePDFRawStream(stream).decode();}catch(e){data=stream.getContents();}}
   if(data)feed(data);const resources=stream.dict?.lookup(PDFLib.PDFName.of('Resources')),objects=resources?.lookup(PDFLib.PDFName.of('XObject'));if(objects instanceof PDFLib.PDFDict)for(const key of objects.keys())walk(objects.lookup(key),depth+1);walk(stream.dict?.lookup(PDFLib.PDFName.of('SMask')),depth+1);
  }
  for(const widget of button.acroField.getWidgets()){const ap=widget.dict.lookup(PDFLib.PDFName.of('AP'));if(ap instanceof PDFLib.PDFDict)walk(ap.lookup(PDFLib.PDFName.of('N')),0);}return (hash>>>0).toString(16);
 }
 function hasImage(button){for(const widget of button.acroField.getWidgets()){const ap=widget.dict.lookup(PDFLib.PDFName.of('AP')),normal=ap?.lookup(PDFLib.PDFName.of('N')),resources=normal?.dict?.lookup(PDFLib.PDFName.of('Resources')),objects=resources?.lookup(PDFLib.PDFName.of('XObject'));if(objects instanceof PDFLib.PDFDict&&objects.keys().length)return true;}return false;}
 async function recoverImages(pdf,form,saved){
  const images=validPhotos(saved?.photos),signatures=saved?.photoFingerprints||{},pending=[];
  for(const m of metadata.config.media){const button=form.getButton(m.name);if(images[m.name]&&signatures[m.name]===iconFingerprint(button))continue;if(hasImage(button))pending.push(m);else images[m.name]=null;}
  for(const page of [...new Set(pending.map(m=>m.page))]){const pg=await pdf.getPage(page),vp=pg.getViewport({scale:3}),canvas=document.createElement('canvas');canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);await pg.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
   for(const m of pending.filter(m=>m.page===page)){const [x,y,w,h]=m.rect,c=document.createElement('canvas');c.width=Math.max(1,Math.round(w*3));c.height=Math.max(1,Math.round(h*3));c.getContext('2d').drawImage(canvas,x*3,vp.height-(y+h)*3,w*3,h*3,0,0,c.width,c.height);images[m.name]=c.toDataURL('image/jpeg',.9);}canvas.width=canvas.height=0;
  }return images;
 }
 function validPhotos(raw){const out={};if(raw&&typeof raw==='object')for(const [name,value] of Object.entries(raw)){if(!/^((foto|rotulo)_\d+_imagem)$/.test(name))continue;if(value===null||typeof value==='string'&&value.length<8*1024*1024&&/^data:image\/(jpeg|png);base64,/.test(value))out[name]=value;}return out;}
 async function exportPDF(){
  if(busy||!metadata)return;busy=true;byId('pdfExport').disabled=true;msg('Preparando o PDF preenchido, com fotos e campos editáveis…');
  try{
   update();const snapshotValues={...values},snapshotPhotos={...photos};const {PDFDocument,StandardFonts,PDFName,PDFString}=PDFLib,doc=await PDFDocument.load(bytes.slice()),form=doc.getForm(),font=await doc.embedFont(StandardFonts.Helvetica);
   const answerAppearances=[];for(const field of form.getFields()){
    const n=field.getName();if(!(n in snapshotValues))continue;if(field instanceof PDFLib.PDFRadioGroup&&metadata.derived.includes(n))for(const widget of field.acroField.getWidgets())answerAppearances.push({widget,ap:widget.dict.get(PDFLib.PDFName.of('AP'))});const v=String(snapshotValues[n]||'').replace(/^\//,'');
    if(field instanceof PDFLib.PDFTextField){field.setText(v);if(metadata.derived.includes(n)){const da=field.acroField.getDefaultAppearance()||'';field.acroField.setDefaultAppearance(da.replace(/[\d.]+\s+Tf/,'0 Tf'));}}
    else if(field instanceof PDFLib.PDFDropdown&&field.getOptions().includes(v))field.select(v);
    else if(field instanceof PDFLib.PDFRadioGroup){const radioValue=v==='NÃO'?'NAO':v;if(field.getOptions().includes(radioValue))field.select(radioValue);else field.clear();}
    if(metadata.derived.includes(n))field.enableReadOnly();else if(/^legal_\d+_atende$/.test(n)){const i=n.split('_')[1];if(snapshotValues['legal_'+i+'_situacao']==='Entregue')field.disableReadOnly();else field.enableReadOnly();}
   }
   form.updateFieldAppearances(font);for(const saved of answerAppearances)if(saved.ap)saved.widget.dict.set(PDFLib.PDFName.of('AP'),saved.ap);
   for(const [n,data] of Object.entries(snapshotPhotos)){const button=form.getButton(n);if(data){const image=/^data:image\/png/.test(data)?await doc.embedPng(data):await doc.embedJpg(data);button.setImage(image);}else button.defaultUpdateAppearances(font);}
   await doc.flush();const photoFingerprints={};for(const n of Object.keys(snapshotPhotos))if(snapshotPhotos[n])photoFingerprints[n]=iconFingerprint(form.getButton(n));
   const backup=doc.context.register(doc.context.flateStream(new TextEncoder().encode(JSON.stringify({format:'guia-appcc-pdf',version,values:snapshotValues,photos:snapshotPhotos,photoFingerprints}))));doc.catalog.set(PDFName.of('APPCCBackup'),backup);
   const result=await doc.save({updateFieldAppearances:false});download('Guia_APPCC_Preenchido_Editavel.pdf',result,'application/pdf');persist();msg('PDF preenchido baixado. Os campos permanecem editáveis e as imagens foram incluídas.');
  }catch(e){console.error(e);msg('Não foi possível gerar o PDF: '+e.message+'. Seu preenchimento foi preservado; salve o JSON.');}finally{busy=false;byId('pdfExport').disabled=false;}
 }
 async function importFile(file){
  if(!file||!metadata)return;
  try{
   if(file.size>80*1024*1024)throw Error('Arquivo maior que 80 MB.');let saved;
   let incomingPdf,incomingBytes;
   if(/\.pdf$/i.test(file.name)){
    const content=new Uint8Array(await file.arrayBuffer()),doc=await PDFLib.PDFDocument.load(content);const stream=doc.catalog.lookup(PDFLib.PDFName.of('APPCCBackup'));if(stream)saved=JSON.parse(new TextDecoder().decode(PDFLib.decodePDFRawStream(stream).decode()));
    if(!saved)saved={format:'guia-appcc-pdf',version,values:{},photos:{}};const f=doc.getForm();if(doc.getPageCount()!==22||!f.getFieldMaybe('p1_vazao_total')||!f.getFieldMaybe('foto_48_imagem'))throw Error('Abra um PDF editável desta revisão.');for(const field of f.getFields()){const n=field.getName();if(!(n in values))continue;let v='';if(field instanceof PDFLib.PDFTextField)v=field.getText()||'';if(field instanceof PDFLib.PDFDropdown)v=field.getSelected()[0]||'';if(field instanceof PDFLib.PDFRadioGroup)v=field.getSelected()||'Off';saved.values[n]=v;}
    const importedDocument=await pdfjs.getDocument({data:content.slice(),isEvalSupported:false}).promise;saved.photos=await recoverImages(importedDocument,f,saved);await importedDocument.destroy();incomingBytes=templateBytes.slice();incomingPdf=await pdfjs.getDocument({data:incomingBytes.slice(),isEvalSupported:false}).promise;
   }else saved=JSON.parse(await file.text());
   if(saved?.format!=='guia-appcc-pdf'||![14,15,16,17,version].includes(saved.version)||!saved.values)throw Error('Use um JSON ou PDF deste guia PDF editável.');
   if(!incomingPdf){incomingBytes=templateBytes.slice();incomingPdf=await pdfjs.getDocument({data:incomingBytes.slice(),isEvalSupported:false}).promise;}
   values={...metadata.defaults};for(const n of Object.keys(values))if(typeof saved.values[n]==='string')values[n]=saved.values[n];photos=validPhotos(saved.photos);if(incomingPdf){const previous=documentPDF;if(renderTask){renderTask.cancel();renderTask=null;}renderSerial++;documentPDF=incomingPdf;bytes=incomingBytes;if(previous&&previous!==incomingPdf)previous.destroy().catch(()=>{});}update();persist();await render();msg('Preenchimento aberto. Respostas, cálculos e imagens foram recuperados.');
  }catch(e){msg('O arquivo não foi aberto: '+e.message);}
 }
 byId('pdfOpen').addEventListener('click',open);byId('pdfExport').addEventListener('click',exportPDF);
 byId('pdfSaveJSON').addEventListener('click',()=>{if(metadata){update();download('Guia_APPCC_PDF_Preenchimento.json',JSON.stringify({format:'guia-appcc-pdf',version,values,photos},null,2),'application/json');}});
 byId('pdfImport').addEventListener('change',async e=>{await importFile(e.target.files[0]);e.target.value='';});
 byId('pdfPrevious').addEventListener('click',()=>{if(documentPDF&&pageNo>1){pageNo--;void render();}});byId('pdfNext').addEventListener('click',()=>{if(documentPDF&&pageNo<22){pageNo++;void render();}});byId('pdfPage').addEventListener('change',e=>{if(documentPDF){pageNo=Number(e.target.value);void render();}});
 byId('pdfZoom').addEventListener('change',e=>{if(documentPDF){byId('pdfPaper').style.width=(Number(e.target.value)*100)+'%';void render();}});

 // Backup periódico separado da gravação imediata dos campos.
 const backupBar=document.createElement('section');backupBar.className='card';backupBar.id='pdfBackup';
 backupBar.innerHTML='<h3>Cópia de segurança automática</h3><label>Intervalo: <input id="pdfBackupMinutes" type="number" min="0.1" max="1440" step="any" style="width:85px"> minutos</label> <button id="pdfBackupNow">Criar cópia agora</button> <button id="pdfBackupRecover">Recuperar preenchimento</button><p id="pdfBackupStatus" role="status"></p><small>Cópias neste navegador, com respostas, fotos e rótulos. Padrão: 5 minutos. Escolha tempos menores ou maiores. Use Salvar JSON para guardar também fora do aparelho. O navegador pode adiar o backup em segundo plano.</small>';
 byId('pdfEditor').insertBefore(backupBar,byId('pdfEditor').children[1]);
 let backupDB,backupBusy=false,backupTimer,backupMinutes=5;
 const backupInput=byId('pdfBackupMinutes'),backupMessage=t=>byId('pdfBackupStatus').textContent=t,backupSetting='appcc-pdf-backup-minutes';
 try{const n=Number(localStorage.getItem(backupSetting));if(n>=.1&&n<=1440)backupMinutes=n;}catch(e){}
 backupInput.value=backupMinutes;
 function backupRequest(fn){return new Promise((resolve,reject)=>{const tx=backupDB.transaction('copies','readwrite'),r=fn(tx.objectStore('copies'));let result;r.onsuccess=()=>result=r.result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
 async function createBackup(){
  if(!metadata){backupMessage('Abra o PDF do guia para iniciar o backup.');return;}
  if(!backupDB||backupBusy||busy)return;backupBusy=true;
  try{const body=JSON.parse(JSON.stringify({format:'guia-appcc-pdf',version,values,photos})),at=new Date().toISOString(),name=values.identificacao_ENVASADORA||'Inspeção sem nome',date=values.identificacao_DATA||'',id=JSON.stringify([name,date]);
   await backupRequest(s=>s.put({id,at,label:name,body}));backupMessage('Cópia salva neste aparelho em '+new Date(at).toLocaleString('pt-BR')+'.');
  }catch(e){backupMessage('Não foi possível criar a cópia. Use Salvar JSON.');}finally{backupBusy=false;}
 }
 function scheduleBackup(){clearInterval(backupTimer);backupTimer=setInterval(createBackup,backupMinutes*60000);}
 backupInput.onchange=()=>{const n=Number(backupInput.value);if(!Number.isFinite(n)||n<.1||n>1440){backupInput.value=backupMinutes;return;}backupMinutes=n;try{localStorage.setItem(backupSetting,String(n));}catch(e){}scheduleBackup();backupMessage('Backup configurado a cada '+n+' minuto(s).');};
 byId('pdfBackupNow').onclick=createBackup;
 byId('pdfBackupRecover').onclick=async()=>{
  if(!backupDB){backupMessage('Recuperação indisponível. Abra seu JSON salvo.');return;}
  try{const rows=(await backupRequest(s=>s.getAll())).sort((a,b)=>b.at.localeCompare(a.at)),dialog=document.createElement('dialog'),title=document.createElement('h2');title.textContent='Recuperar preenchimento do PDF';dialog.append(title);
   if(!rows.length){const p=document.createElement('p');p.textContent='Nenhuma cópia disponível neste navegador.';dialog.append(p);}
   for(const row of rows){const p=document.createElement('p'),button=document.createElement('button');button.textContent=row.label+' — '+new Date(row.at).toLocaleString('pt-BR');button.onclick=async()=>{if(!confirm('Substituir o preenchimento aberto por esta cópia? Salve o JSON atual se precisar preservá-lo.'))return;await createBackup();await importFile(new File([JSON.stringify(row.body)],'Recuperacao_PDF.json',{type:'application/json'}));dialog.close();dialog.remove();};p.append(button);dialog.append(p);}
   const close=document.createElement('button');close.textContent='Fechar';close.onclick=()=>{dialog.close();dialog.remove();};dialog.append(close);document.body.append(dialog);dialog.showModal();
  }catch(e){backupMessage('Não foi possível consultar as cópias. Use seu JSON salvo.');}
 };
 try{const dbOpen=indexedDB.open('appcc-pdf-backups',1);dbOpen.onupgradeneeded=()=>dbOpen.result.createObjectStore('copies',{keyPath:'id'});dbOpen.onsuccess=async()=>{backupDB=dbOpen.result;const rows=await backupRequest(s=>s.getAll());backupMessage(rows.length?'Há '+rows.length+' preenchimento(s) anterior(es). Toque em Recuperar preenchimento.':'Recuperação automática disponível neste aparelho.');scheduleBackup();};dbOpen.onerror=()=>backupMessage('Backup indisponível. Use Salvar JSON.');}catch(e){backupMessage('Backup indisponível. Use Salvar JSON.');}
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&metadata)createBackup();});

})();