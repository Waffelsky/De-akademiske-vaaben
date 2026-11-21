const API = "/api/v1";
const REFRESH_MS = 5000;
const INTERVAL_MINUTES = 30;
const FORECAST_STEPS = 8; // 4 hours at 30-minute intervals
let dashboardData = { sensors: [], readings: [], anomalies: [], notifications: [], events: [] };
let selectedSensorId = null;
let refreshInProgress = false;

async function fetchData(path, options = {}) {
  const response = await fetch(`${API}${path}`, options);
  if (!response.ok) throw new Error(`API request failed (${response.status})`);
  return response.json();
}
const byId = id => document.getElementById(id);
const setText = (id, value) => { if (byId(id)) byId(id).textContent = value; };
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function formatDate(value) {
  if (!value) return "Ukendt tidspunkt";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Ukendt tidspunkt" : date.toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
}
function getSensorReadings(sensorId) {
  // API results are newest-first. IDs preserve insertion order when demo timestamps are identical.
  return dashboardData.readings.filter(r => String(r.sensor_id) === String(sensorId))
    .sort((a,b) => Number(a.id) - Number(b.id));
}
function getSensorStatus(sensor, reading) {
  if (!sensor.is_active || !reading) return "Unknown";
  const value = Number(reading.value);
  if ((sensor.min_threshold != null && value < Number(sensor.min_threshold)) ||
      (sensor.max_threshold != null && value > Number(sensor.max_threshold))) return "Alarm";
  return "Normal";
}
function statusMarkup(status) {
  const cls = status === "Normal" ? "normal" : status === "Alarm" ? "alarm" : "unknown";
  const label = status === "Unknown" ? "No data / inactive" : status;
  return `<span class="status ${cls}">${label}</span>`;
}
function renderSensors() {
  const query = (byId("sensor-search")?.value || "").toLowerCase().trim();
  const sensors = dashboardData.sensors.filter(s => `${s.name} ${s.sensor_code} ${s.measurement_type}`.toLowerCase().includes(query));
  const body = byId("sensor-table");
  if (!sensors.length) { body.innerHTML = `<tr><td colspan="6" class="empty-state">No matching sensors found.</td></tr>`; return; }
  body.innerHTML = sensors.map(sensor => {
    const readings = getSensorReadings(sensor.id), latest = readings.at(-1), status = getSensorStatus(sensor, latest);
    return `<tr class="sensor-row" data-sensor-id="${escapeHtml(sensor.id)}" tabindex="0" role="button">
      <td><div class="sensor-name">${escapeHtml(sensor.name)}</div><div class="sensor-code">${escapeHtml(sensor.sensor_code)}</div></td>
      <td>${escapeHtml(sensor.measurement_type)}</td>
      <td><span class="value-cell">${latest ? `${escapeHtml(latest.value)} ${escapeHtml(sensor.unit)}` : "—"}</span></td>
      <td>${escapeHtml(sensor.min_threshold)} – ${escapeHtml(sensor.max_threshold)} ${escapeHtml(sensor.unit)}</td>
      <td>${statusMarkup(sensor.is_active ? status : "Unknown")}</td><td><span class="view-link">Inspect →</span></td></tr>`;
  }).join("");
}
function renderHealth() {
  let normal=0, alarm=0, unknown=0;
  dashboardData.sensors.forEach(sensor => {
    const status = sensor.is_active ? getSensorStatus(sensor, getSensorReadings(sensor.id).at(-1)) : "Unknown";
    if (status === "Normal") normal++; else if (status === "Alarm") alarm++; else unknown++;
  });
  const total = dashboardData.sensors.length, pct = total ? Math.round(normal / total * 100) : 0;
  setText("normal-count", normal); setText("critical-count", alarm); setText("unknown-count", unknown); setText("health-percent", `${pct}%`);
  const ring = byId("health-ring");
  if (ring) ring.style.background = `conic-gradient(#19966c ${pct*3.6}deg, #d45151 ${pct*3.6}deg ${(pct+ (total ? alarm/total*100 : 0))*3.6}deg, #edf1f5 0deg)`;
}
function renderAlarms() {
  const all = dashboardData.notifications;
  const open = all.filter(n => !n.acknowledged);
  setText("alarm-count", open.length); setText("alarm-chip", `${open.length} open`);
  const list = byId("alarm-list");
  if (!all.length) { list.innerHTML = `<div class="empty-state">No notifications have been recorded.</div>`; return; }
  const sorted = [...all].sort((a,b) => Number(a.acknowledged)-Number(b.acknowledged) || Number(b.id)-Number(a.id)).slice(0,6);
  list.innerHTML = sorted.map(n => {
    const warning = String(n.severity).toLowerCase() === "warning";
    const sensor = dashboardData.sensors.find(s => Number(s.id) === Number(dashboardData.anomalies.find(a => Number(a.id) === Number(n.anomaly_id))?.sensor_id));
    return `<div class="alarm-item ${warning ? "warning" : ""}"><div><div class="severity ${warning ? "warning" : ""}">${escapeHtml(n.severity || "Alert")}</div><div class="alarm-title">${escapeHtml(n.title)}</div><p>${escapeHtml(n.message)}${sensor ? ` · ${escapeHtml(sensor.sensor_code)}` : ""}</p>${!n.acknowledged ? `<button class="ack-button" data-ack="${escapeHtml(n.id)}">Acknowledge alert</button>` : ""}</div><div class="alarm-meta">${formatDate(n.created_at)}<br>${n.acknowledged ? "Acknowledged" : "Open"}</div></div>`;
  }).join("");
}
function renderEvents() {
  const events = dashboardData.events.slice(0,10), container = byId("event-list");
  if (!events.length) { container.innerHTML = `<div class="empty-state">No domain events have been recorded yet.</div>`; return; }
  container.innerHTML = events.map(event => {
    const sensor = dashboardData.sensors.find(s => Number(s.id) === Number(event.sensor_id));
    return `<div class="event-item"><span class="event-marker"></span><div><div class="event-title">${escapeHtml(event.event_type)}</div><div class="event-description">${sensor ? escapeHtml(sensor.name) : `Sensor #${escapeHtml(event.sensor_id)}`} · Reading #${escapeHtml(event.reading_id ?? "—")}</div></div><time class="event-time">${formatDate(event.occurred_at)}</time></div>`;
  }).join("");
}

// Non-ML forecast: adaptive, damped-trend extrapolation.
// Recent slopes are weighted more heavily; acceleration bends the trajectory, while damping
// gradually reduces the estimated rate of change. This is deliberately not linear regression.
function calculateForecast(values) {
  if (values.length < 3) return { points: [], method: "Insufficient history" };
  const recent = values.slice(-8), slopes = [];
  for (let i=1;i<recent.length;i++) slopes.push(recent[i]-recent[i-1]);
  let weighted=0, weights=0;
  slopes.forEach((s,i) => { const w = Math.pow(1.55, i); weighted += s*w; weights += w; });
  let slope = weighted / weights;
  const changes = slopes.slice(1).map((s,i) => s-slopes[i]);
  let acceleration = 0;
  if (changes.length) {
    let sum=0, total=0;
    changes.forEach((v,i) => { const w=Math.pow(1.4,i); sum+=v*w; total+=w; });
    acceleration = sum/total;
  }
  const scale = Math.max(0.0001, Math.max(...recent)-Math.min(...recent));
  slope = Math.max(-scale*0.65, Math.min(scale*0.65, slope));
  acceleration = Math.max(-scale*0.12, Math.min(scale*0.12, acceleration));
  const damping = 5.5, last = values.at(-1);
  const points=[];
  for(let h=1;h<=FORECAST_STEPS;h++) {
    const decay = Math.exp(-h/damping);
    const trend = slope*damping*(1-decay);
    const curve = 0.5*acceleration*h*h*Math.exp(-h/(damping*1.25));
    points.push(last + trend + curve);
  }
  return { points, method: "Damped adaptive trend with recent slope and curvature" };
}
function renderSensorDetails() {
  if (selectedSensorId == null) return;
  const sensor = dashboardData.sensors.find(s => String(s.id) === selectedSensorId);
  if (!sensor) { closeSensorDetails(); return; }
  const readings = getSensorReadings(sensor.id), latest = readings.at(-1), status = getSensorStatus(sensor,latest), unit = sensor.unit || "";
  setText("detail-title", sensor.name || sensor.sensor_code);
  setText("detail-subtitle", `${sensor.sensor_code} · ${sensor.measurement_type}`);
  setText("detail-value", latest ? `${latest.value} ${unit}` : "No readings");
  setText("detail-time", latest ? `Source timestamp: ${formatDate(latest.received_at)}` : "No source timestamp available");
  setText("detail-min", `${sensor.min_threshold} ${unit}`); setText("detail-max", `${sensor.max_threshold} ${unit}`);
  setText("detail-status", status === "Unknown" ? "No data" : status);
  setText("detail-status-text", status === "Normal" ? "Within configured limits" : status === "Alarm" ? "Outside configured limits" : "Inactive or no measurements");
  renderSensorChart(sensor, readings); renderMeasurementHistory(sensor, readings);
}
function renderSensorChart(sensor, readings) {
  const container=byId("sensor-chart");
  const valid=readings.filter(r=>Number.isFinite(Number(r.value)));
  if (!valid.length) { container.innerHTML=`<div class="empty-state">No measurements are available for this sensor.</div>`; setText("forecast-note","A forecast requires at least three valid historical measurements."); return; }
  const values=valid.map(r=>Number(r.value)), forecast=calculateForecast(values);
  const minT=Number(sensor.min_threshold), maxT=Number(sensor.max_threshold);
  const all=[...values,...forecast.points];
  if(Number.isFinite(minT)) all.push(minT); if(Number.isFinite(maxT)) all.push(maxT);
  let min=Math.min(...all), max=Math.max(...all); if(min===max){min-=1;max+=1;} const pad=(max-min)*.16; min-=pad;max+=pad;
  const W=900,H=290,L=64,R=22,T=24,B=48,plotW=W-L-R,plotH=H-T-B;
  const total=valid.length+forecast.points.length-1;
  const x=i=>L+(total ? i/total*plotW : plotW/2), y=v=>T+(max-v)/(max-min)*plotH;
  const hist=values.map((v,i)=>`${x(i)},${y(v)}`).join(" ");
  const forecastPoints=forecast.points.map((v,i)=>`${x(values.length-1+i+1)},${y(v)}`).join(" ");
  const grid=[0,1,2,3,4].map(i=>{const yy=T+plotH*i/4, val=max-(max-min)*i/4;return `<line class="chart-grid" x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}"/><text class="chart-axis" x="${L-10}" y="${yy+4}" text-anchor="end">${val.toFixed(1)}</text>`;}).join("");
  const threshold=(v,label)=>Number.isFinite(v)?`<line class="chart-threshold" x1="${L}" y1="${y(v)}" x2="${W-R}" y2="${y(v)}"/><text x="${W-R-2}" y="${y(v)-6}" text-anchor="end" fill="#c65a5a" font-size="10">${label} ${v}</text>`:"";
  const histDots=values.map((v,i)=>`<circle class="chart-point" cx="${x(i)}" cy="${y(v)}" r="3.5"><title>Measured: ${v} ${escapeHtml(sensor.unit)}</title></circle>`).join("");
  const predDots=forecast.points.map((v,i)=>`<circle class="chart-forecast-point" cx="${x(values.length+i)}" cy="${y(v)}" r="3"><title>Forecast: ${v.toFixed(2)} ${escapeHtml(sensor.unit)}</title></circle>`).join("");
  const split=x(values.length-1);
  const startOffset=-(values.length-1)*INTERVAL_MINUTES;
  const labelAt=(idx)=>{const mins=idx*INTERVAL_MINUTES; if(idx===values.length-1)return "Now"; if(idx>values.length-1)return `+${(mins-(values.length-1)*INTERVAL_MINUTES)/60}h`; const ago=(values.length-1-idx)*INTERVAL_MINUTES;return ago%60===0?`−${ago/60}h`:`−${ago}m`;};
  const ticks=[0,Math.floor((values.length-1)/2),values.length-1,values.length+3,values.length+7].filter((v,i,a)=>a.indexOf(v)===i);
  const xLabels=ticks.map(i=>`<text class="chart-axis" x="${x(i)}" y="${H-15}" text-anchor="middle">${labelAt(i)}</text>`).join("");
  container.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Historical sensor measurements with mathematical forecast" xmlns="http://www.w3.org/2000/svg">${grid}${threshold(minT,"Min")}${threshold(maxT,"Max")}<line class="forecast-divider" x1="${split}" y1="${T}" x2="${split}" y2="${T+plotH}"/><polyline class="chart-history" points="${hist}"/><polyline class="chart-forecast" points="${split},${y(values.at(-1))} ${forecastPoints}"/>${histDots}${predDots}${xLabels}<text class="chart-axis" x="${L}" y="${H-2}">Historical · 30 min per point</text><text class="chart-axis" x="${W-R}" y="${H-2}" text-anchor="end">Forecast · 30 min per step</text></svg>`;
  if(forecast.points.length){const crossing=forecast.points.findIndex(v=>(Number.isFinite(maxT)&&v>maxT)||(Number.isFinite(minT)&&v<minT));setText("forecast-note",`Mathematical estimate · Damped adaptive trend (not AI/ML). Each historical point is spaced 30 minutes apart on the display axis; source timestamps remain unchanged. ${crossing>=0?`The estimate reaches a configured limit in approximately ${(crossing+1)*30} minutes.`:"No configured threshold crossing is indicated within the 4-hour forecast window."}`);} else setText("forecast-note","At least three measurements are needed. Forecast is a mathematical estimate, not measured data or machine learning.");
}
function renderMeasurementHistory(sensor, readings) {
  const body=byId("detail-history"), latest=[...readings].reverse().slice(0,10);
  if(!latest.length){body.innerHTML=`<tr><td colspan="3" class="empty-state">No readings available.</td></tr>`;return;}
  body.innerHTML=latest.map(r=>`<tr><td><span class="value-cell">${escapeHtml(r.value)} ${escapeHtml(sensor.unit)}</span></td><td>${formatDate(r.received_at)}</td><td>${statusMarkup(getSensorStatus(sensor,r))}</td></tr>`).join("");
}
function openSensorDetails(id){selectedSensorId=String(id);byId("sensor-details").hidden=false;renderSensorDetails();byId("sensor-details").scrollIntoView({behavior:"smooth",block:"start"});}
function closeSensorDetails(){selectedSensorId=null;byId("sensor-details").hidden=true;}
async function acknowledge(id){try{await fetchData(`/notifications/${id}/acknowledge`,{method:"PATCH"});await refreshDashboard();}catch(error){console.error(error);alert("The alert could not be acknowledged. Please try again.");}}
async function refreshDashboard(){if(refreshInProgress)return;refreshInProgress=true;try{
  const [sensors,readings,anomalies,notifications,events]=await Promise.all([fetchData("/sensors"),fetchData("/readings?limit=500"),fetchData("/anomalies?limit=100"),fetchData("/notifications?limit=100"),fetchData("/events?limit=100")]);
  dashboardData={sensors,readings,anomalies,notifications,events};
  setText("sensor-count",sensors.filter(s=>s.is_active).length);setText("reading-count",readings.length);setText("anomaly-count",anomalies.length);
  renderAlarms();renderHealth();renderSensors();renderEvents();if(selectedSensorId!==null)renderSensorDetails();
  setText("connection-status","Connected");setText("last-updated",new Date().toLocaleTimeString("da-DK"));
 }catch(error){console.error("Dashboard refresh failed",error);setText("connection-status","Connection error");setText("last-updated","API unavailable");}finally{refreshInProgress=false;}}
byId("sensor-table").addEventListener("click",e=>{const row=e.target.closest(".sensor-row");if(row)openSensorDetails(row.dataset.sensorId);});
byId("sensor-table").addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){const row=e.target.closest(".sensor-row");if(row){e.preventDefault();openSensorDetails(row.dataset.sensorId);}}});
byId("sensor-search").addEventListener("input",renderSensors);
byId("alarm-list").addEventListener("click",e=>{const button=e.target.closest("[data-ack]");if(button)acknowledge(button.dataset.ack);});
byId("close-details").addEventListener("click",closeSensorDetails);
refreshDashboard();setInterval(refreshDashboard,REFRESH_MS);
