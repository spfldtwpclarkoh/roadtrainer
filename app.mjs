import { distanceMeters, inGeometry, shuffled } from './geo.mjs';
import { createPracticeContext } from './practice-context.mjs';
const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let map, tiles, boundaries, townshipLayer, township, streets=[], pointLayer, highlightLayer, practiceContext, mode='study', selected=null, quiz=null, missed=[];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const latlng = p => [p[1],p[0]];
const quizActive = () => mode === 'quiz' && quiz && quiz.index < quiz.roads.length && !quiz.answered;

function setBasemap(visible) {
  if(visible)practiceContext?.hide();
  if(visible && !map.hasLayer(tiles)) tiles.addTo(map);
  if(!visible && map.hasLayer(tiles)) map.removeLayer(tiles);
}
function caption(text) { $('map-caption').textContent=text; $('map-caption').hidden=!text; }
function townshipView() { map.fitBounds(townshipLayer.getBounds(),{padding:[25,25],animate:!reducedMotion}); }
function clearHighlight() { highlightLayer.clearLayers(); }
function pointRadius() { const zoom=map.getZoom()??10;return zoom<12?1:zoom<14?1.5:2.3; }
function contextPoints() {
  pointLayer.clearLayers();
  for (const street of streets) for(const p of street.points) {
    const marker=L.circleMarker(latlng(p),{radius:pointRadius(),color:'#354e65',weight:0,fillOpacity:mode==='study'?.42:.3,interactive:mode==='study'}).addTo(pointLayer);
    if(mode==='study') marker.bindPopup(`<strong>${escape(p[2])} ${escape(street.name)}</strong><br>Springfield Township`).on('click',()=>selectStreet(street.id,false));
  }
}
function markStreet(street, zoom=true, reveal=false) {
  clearHighlight();
  for(const p of street.points) {
    const marker=L.circleMarker(latlng(p),{radius:5,color:'#7b3e05',weight:1.4,fillColor:'#ffac45',fillOpacity:1,interactive:reveal||mode==='study'}).addTo(highlightLayer);
    if(reveal||mode==='study') marker.bindPopup(`<strong>${escape(p[2])} ${escape(street.name)}</strong><br>Township address`);
  }
  if(zoom) map.fitBounds(L.latLngBounds(street.points.map(latlng)).pad(.35),{padding:[50,65],maxZoom:15,animate:!reducedMotion});
}
function streetDetail(street) {
  const numbers=street.points.map(p=>Number(p[2])).filter(n=>Number.isFinite(n)&&n>0);
  return `${street.points.length.toLocaleString()} township address${street.points.length===1?'':'es'}${numbers.length?` · Address range ${Math.min(...numbers)}–${Math.max(...numbers)}`:''}`;
}
function renderStreetList() {
  const term=$('street-search').value.trim().toUpperCase();
  const results=streets.filter(s=>s.name.includes(term));
  $('street-count').textContent=`${results.length} street${results.length===1?'':'s'}`;
  $('street-list').innerHTML=results.length?results.map(s=>`<button class="street-row${selected===s.id?' selected':''}" data-street="${s.id}" aria-pressed="${selected===s.id}"><span>${escape(s.name)}</span><span>${s.points.length}</span></button>`).join(''):'<p class="empty">No township streets match that search. Try part of the street name.</p>';
}
function selectStreet(id, zoom=true) {
  const street=streets.find(s=>s.id===Number(id));
  if(!street) throw new Error('Unknown township street.');
  selected=street.id;
  markStreet(street,zoom,true); renderStreetList();
  $('selected-detail').hidden=false;
  $('selected-detail').innerHTML=`<h3>${escape(street.name)}</h3><p>${escape(streetDetail(street))}</p>`;
  $('map-heading').textContent=street.name; caption('Highlighted dots are township addresses on this street.');
  return {name:street.name,addressCount:street.points.length};
}
function setMode(next) {
  if(!map) return;
  mode=next; map.closePopup(); clearHighlight();$('map').parentElement.classList.remove('locating');
  $('study-panel').hidden=mode!=='study'; $('quiz-panel').hidden=mode!=='quiz';
  $('study-tab').classList.toggle('active',mode==='study'); $('quiz-tab').classList.toggle('active',mode==='quiz');
  $('study-tab').setAttribute('aria-pressed',mode==='study'); $('quiz-tab').setAttribute('aria-pressed',mode==='quiz');
  contextPoints();
  if(mode==='study') {
    setBasemap(true); $('map-heading').textContent='Springfield Township';
    if(selected!==null) selectStreet(selected); else {townshipView();caption('Select a street to explore its township addresses.');}
  } else {
    quiz=null; $('quiz-setup').hidden=false; $('quiz-play').hidden=true;
    setBasemap(true); townshipView(); $('map-heading').textContent='Springfield Township'; caption('Choose a drill to practice township streets.');
  }
}
function startQuiz(type) {
  if(!['identify','locate'].includes(type)) throw new Error('Choose a valid drill.');
  if(mode!=='quiz') setMode('quiz');
  quiz={type,roads:shuffled(streets).slice(0,10),index:0,score:0,answered:false}; missed=[];
  $('quiz-setup').hidden=true; $('quiz-play').hidden=false; nextQuestion();
  return {type,questions:quiz.roads.length};
}
function nextQuestion() {
  if(quiz.index>=quiz.roads.length) {finishQuiz();return;}
  quiz.answered=false; map.closePopup(); setBasemap(false); clearHighlight();
  $('map').parentElement.classList.toggle('locating',quiz.type==='locate');
  const street=quiz.roads[quiz.index];
  practiceContext.show(street);
  $('map-heading').textContent=quiz.type==='identify'?'Name the street':'Locate the street';
  const choices=shuffled([street,...shuffled(streets.filter(s=>s.id!==street.id)).slice(0,3)]);
  const instruction=quiz.type==='identify'?'Which street is highlighted?':street.name;
  $('quiz-play').innerHTML=`<div class="quiz-progress"><span>Question ${quiz.index+1} of ${quiz.roads.length}</span><strong>${quiz.score} correct</strong></div><div class="progress-track" role="progressbar" aria-label="Questions completed" aria-valuemin="0" aria-valuemax="${quiz.roads.length}" aria-valuenow="${quiz.index}"><div style="width:${quiz.index/quiz.roads.length*100}%"></div></div><h3 class="question">${escape(instruction)}</h3>${quiz.type==='identify'?`<div class="answer-list">${choices.map(s=>`<button data-answer="${s.id}">${escape(s.name)}</button>`).join('')}</div>`:'<p class="drill-help">Click or tap near a township address on this street. A point within 200 metres counts. You can also pan the map with arrow keys and submit its centre.</p><button id="submit-center" class="primary wide">Submit map centre</button>'}<div id="answer-feedback" role="status" aria-live="polite"></div><div class="quiz-buttons"><button id="skip-question">Reveal &amp; continue</button><button id="end-quiz">End drill</button></div>`;
  if(quiz.type==='identify') {markStreet(street);caption('Use neighboring roads and landmarks. The tested street’s name is hidden.');}
  else {townshipView();caption('Find the street using neighboring road names. Its own label is hidden.');}
}
function answer(correct, description, skipped=false) {
  if(!quizActive()) return;
  quiz.answered=true;$('map').parentElement.classList.remove('locating');
  const street=quiz.roads[quiz.index];
  if(correct) quiz.score++; else missed.push(street);
  $('quiz-play').querySelector('.quiz-progress strong').textContent=`${quiz.score} correct`;
  setBasemap(true); markStreet(street,true,true);
  for(const button of $('quiz-play').querySelectorAll('[data-answer]')) {
    button.disabled=true;
    if(Number(button.dataset.answer)===street.id) button.classList.add('correct');
  }
  if($('submit-center')) $('submit-center').disabled=true;
  $('answer-feedback').innerHTML=`<div class="feedback ${correct?'good':'bad'}"><strong>${skipped?'Review this street':correct?'Correct':'Keep practicing'} · ${escape(street.name)}</strong><br>${escape(description)}<br>${escape(streetDetail(street))}</div>`;
  $('skip-question').hidden=true;
  const next=document.createElement('button'); next.className='primary';next.id='next-question';next.textContent=quiz.index===quiz.roads.length-1?'See results':'Next street';
  $('quiz-play').querySelector('.quiz-buttons').prepend(next); next.focus({preventScroll:true});
  caption(`${street.name} · Orange dots show its township addresses.`);
}
function locate(point) {
  if(!quizActive()||quiz.type!=='locate') return;
  const street=quiz.roads[quiz.index];
  const distance=Math.min(...street.points.map(p=>distanceMeters(point,p)));
  const inside=inGeometry(point,township.geometry);
  const correct=inside&&distance<=200;
  answer(correct,!inside?'That location is outside Springfield Township. The correct address pattern is now highlighted.':correct?`Your location is ${Math.round(distance)} metres from a township address on this street.`:`Your location is ${Math.round(distance).toLocaleString()} metres from the nearest township address on this street. Its address pattern is now highlighted.`);
  L.circleMarker(latlng(point),{radius:8,color:correct?'#167047':'#b53d30',weight:3,fillOpacity:0,interactive:false}).addTo(highlightLayer);
}
function finishQuiz() {
  clearHighlight(); setBasemap(true); townshipView(); caption('Drill complete. Review missed streets or try a new selection.');
  $('map-heading').textContent='Drill complete';
  $('quiz-play').innerHTML=`<span class="eyebrow">DRILL COMPLETE</span><div class="score">${quiz.score}<span style="font-size:1.5rem;color:var(--muted)"> / ${quiz.roads.length}</span></div><p class="drill-help">${missed.length?'Spend a little more time with these streets.':'Every street correct. Try a new selection to keep learning.'}</p>${missed.length?`<div class="missed-list">${missed.map(s=>`<button data-review="${s.id}">Study ${escape(s.name)}</button>`).join('')}</div>`:''}<button id="retry-quiz" class="primary wide">Try another drill</button><button id="back-study" class="wide" style="margin-top:10px">Return to study map</button>`;
}
function wireUI() {
  $('study-tab').onclick=()=>setMode('study'); $('quiz-tab').onclick=()=>setMode('quiz');
  $('street-search').oninput=renderStreetList;
  $('street-list').onclick=e=>{const row=e.target.closest('[data-street]');if(row) selectStreet(row.dataset.street);};
  $('township-view').onclick=townshipView;
  $('county-view').onclick=()=>map.fitBounds(boundaries.getBounds(),{padding:[25,25],animate:!reducedMotion});
  $('quiz-type').onchange=()=>{$('drill-help').textContent=$('quiz-type').value==='identify'?'Use neighboring street names and landmarks to identify the orange address pattern. Only the tested street’s name is hidden.':'Use neighboring street names to find the named street. Its own label stays hidden. Click within 200 metres of a township address on it.';};
  $('start-quiz').onclick=()=>startQuiz($('quiz-type').value);
  $('quiz-play').onclick=e=>{
    const choice=e.target.closest('[data-answer]');
    if(choice&&quizActive()) {const correct=Number(choice.dataset.answer)===quiz.roads[quiz.index].id; if(!correct) choice.classList.add('wrong');answer(correct,correct?'Recognized the address pattern. Explore the labeled map before continuing.':'The correct street and labeled map are now shown.');return;}
    const review=e.target.closest('[data-review]');if(review){setMode('study');selectStreet(review.dataset.review);return;}
    if(e.target.id==='next-question'){quiz.index++;nextQuestion();}
    if(e.target.id==='skip-question') answer(false,'The labeled map is now shown. This question counts as missed.',true);
    if(e.target.id==='end-quiz') setMode('quiz');
    if(e.target.id==='retry-quiz') startQuiz(quiz.type);
    if(e.target.id==='back-study') setMode('study');
    if(e.target.id==='submit-center'){const p=map.getCenter();locate([p.lng,p.lat]);}
  };
  map.on('click',event=>locate([event.latlng.lng,event.latlng.lat]));
}
async function registerTools() {
  if(!document.modelContext?.registerTool) return;
  const lifecycle=new AbortController(); window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  const tools=[
    {name:'study_township_street',title:'Study a township street',description:'Select a Springfield Township street by exact name and show its address points on the study map.',inputSchema:{type:'object',properties:{name:{type:'string'}},required:['name'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||typeof input.name!=='string')throw new Error('A street name is required.');const street=streets.find(s=>s.name===input.name.trim().toUpperCase());if(!street)throw new Error('Street is not in the township training list.');setMode('study');return selectStreet(street.id);}},
    {name:'start_township_drill',title:'Start a township drill',description:'Start a new ten-question Springfield Township street drill in the visible practice panel.',inputSchema:{type:'object',properties:{type:{type:'string',enum:['identify','locate']}},required:['type'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){return startQuiz(input?.type);}}
  ];
  for(const tool of tools) try{await document.modelContext.registerTool(tool,{signal:lifecycle.signal});}catch(error){console.warn('Optional browser tool unavailable',error);}
}
async function init() {
  try {
    if(!window.L) throw new Error('The local map library could not be loaded.');
    const fetchJSON=async url=>{const response=await fetch(url);if(!response.ok)throw new Error(`Could not load ${url}.`);return response.json();};
    const [boundaryData,data,contextData]=await Promise.all([fetchJSON('./data/boundaries.geojson'),fetchJSON('./data/streets.json'),fetchJSON('./data/map-context.geojson')]);
    streets=data.streets;if(streets.length<4)throw new Error('At least four streets are required for drills.');
    township=boundaryData.features.find(f=>f.properties.kind==='township'&&f.properties.name.toUpperCase()==='SPRINGFIELD');
    map=L.map('map',{preferCanvas:true,minZoom:9,maxZoom:19,zoomControl:true});
    tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'});
    let tileFailures=0;
    tiles.on('tileerror',()=>{if(++tileFailures>=3&&map.hasLayer(tiles)){$('load-status').hidden=false;$('load-status').classList.remove('error');$('load-status').textContent='Street map tiles are unavailable. Township boundaries and address drills remain available.';}});
    tiles.on('tileload',()=>{tileFailures=0;$('load-status').hidden=true;});
    setBasemap(true);
    boundaries=L.geoJSON(boundaryData,{filter:f=>f!==township,style:f=>({color:'#477ca7',weight:1,fillColor:'#83aac9',fillOpacity:f.properties.kind==='municipality'?.3:.22}),onEachFeature:(f,l)=>l.bindTooltip(`${escape(f.properties.name)}${f.properties.kind==='township'?' Township':''}`,{sticky:true})}).addTo(map);
    townshipLayer=L.geoJSON(township,{style:{color:'#b86416',weight:2.5,fillColor:'#f89d40',fillOpacity:.34},onEachFeature:(f,l)=>l.bindTooltip('Springfield Township',{sticky:true})}).addTo(map);
    pointLayer=L.layerGroup().addTo(map);highlightLayer=L.layerGroup().addTo(map);
    practiceContext=createPracticeContext(map,contextData);
    map.setMaxBounds(boundaries.getBounds().pad(.4));L.control.scale({imperial:true,metric:false,position:'bottomright'}).addTo(map);
    map.on('zoomend',()=>pointLayer.eachLayer(marker=>marker.setRadius(pointRadius())));
    contextPoints();townshipView();wireUI();renderStreetList();
    for(const id of ['street-search','start-quiz','township-view','county-view']) $(id).disabled=false;
    $('data-summary').textContent=`${streets.length.toLocaleString()} township streets · ${data.addressCount.toLocaleString()} address points`;
    $('load-status').hidden=true;caption('Select a street to explore its township addresses.');
    await registerTools();
  } catch(error) {
    $('load-status').hidden=false;$('load-status').classList.add('error');$('load-status').textContent=`Unable to load the trainer. ${error.message} Open the app through a web server or GitHub Pages, then reload.`;
    $('street-count').textContent='Map unavailable';$('data-summary').textContent='Geographic data could not be loaded.';console.error(error);
  }
}
init();
