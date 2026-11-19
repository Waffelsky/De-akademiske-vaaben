
const API = "/api/v1";

let dashboardData = {
    sensors: [],
    readings: [],
    anomalies: [],
    notifications: [],
    events: []
};

let selectedSensorId = null;
let refreshInProgress = false;

async function fetchData(endpoint) {
    const response = await fetch(`${API}${endpoint}`);

    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }

    return response.json();
}

function setText(id, value) {
    document.getElementById(id).textContent = value;
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function formatDate(value) {
    if (!value) return "Unknown time";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Unknown time";
    }

    return date.toLocaleString("da-DK", {
        dateStyle: "short",
        timeStyle: "short"
    });
}

function getSensorReadings(sensorId) {
    return dashboardData.readings
        .filter(reading => String(reading.sensor_id) === String(sensorId))
        .sort((a, b) =>
            new Date(a.received_at) - new Date(b.received_at)
        );
}

function getSensorStatus(sensor, reading) {
    if (!sensor.is_active) {
        return "Inactive";
    }

    if (!reading) {
        return "No readings";
    }

    const value = Number(reading.value);

    if (
        sensor.min_threshold !== null &&
        sensor.min_threshold !== undefined &&
        value < Number(sensor.min_threshold)
    ) {
        return "Alarm";
    }

    if (
        sensor.max_threshold !== null &&
        sensor.max_threshold !== undefined &&
        value > Number(sensor.max_threshold)
    ) {
        return "Alarm";
    }

    return "Normal";
}

function getStatusClass(status) {
    if (status === "Alarm") return "alarm";
    if (status === "Normal") return "normal";
    return "unknown";
}

function renderSensors(sensors) {
    const table = document.getElementById("sensor-table");

    if (!sensors.length) {
        table.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    No sensors registered yet.
                </td>
            </tr>`;
        return;
    }

    table.innerHTML = sensors.map(sensor => {
        const readings = getSensorReadings(sensor.id);
        const latestReading = readings.length
            ? readings[readings.length - 1]
            : null;

        const value = latestReading?.value;
        const hasReading = value !== undefined && value !== null;
        const status = getSensorStatus(sensor, latestReading);

        return `
            <tr
                class="sensor-row"
                data-sensor-id="${escapeHtml(sensor.id)}"
                tabindex="0"
                role="button"
                aria-label="View details for ${escapeHtml(sensor.name)}"
            >
                <td>
                    <strong class="sensor-link">
                        ${escapeHtml(sensor.sensor_code)}
                    </strong>
                    <small>${escapeHtml(sensor.name)}</small>
                </td>

                <td>${escapeHtml(sensor.measurement_type)}</td>

                <td>
                    <strong>
                        ${hasReading
                            ? `${escapeHtml(value)} ${escapeHtml(sensor.unit)}`
                            : "—"}
                    </strong>
                    <small>
                        ${latestReading
                            ? formatDate(latestReading.received_at)
                            : "No measurement"}
                    </small>
                </td>

                <td>
                    ${escapeHtml(sensor.min_threshold ?? "—")}
                    – ${escapeHtml(sensor.max_threshold ?? "—")}
                    ${escapeHtml(sensor.unit)}
                </td>

                <td>
                    <span class="status ${getStatusClass(status)}">
                        ${escapeHtml(status)}
                    </span>
                </td>
            </tr>`;
    }).join("");
}

function renderAlarms(notifications) {
    const container = document.getElementById("alarm-list");

    if (!notifications.length) {
        container.innerHTML = `
            <div class="empty-state">
                No notifications registered.
            </div>`;
        return;
    }

    container.innerHTML = notifications.map(notification => `
        <div class="alarm-item">
            <div>
                <strong>${escapeHtml(notification.title)}</strong>
                <p>${escapeHtml(notification.message)}</p>
                <p>
                    Severity: ${escapeHtml(notification.severity)}
                    · ${notification.acknowledged
                        ? "Acknowledged"
                        : "Needs attention"}
                </p>
            </div>
            <small>${formatDate(notification.created_at)}</small>
        </div>
    `).join("");
}

function renderEvents(events) {
    const container = document.getElementById("event-list");

    if (!events.length) {
        container.innerHTML = `
            <div class="empty-state">
                No events registered.
            </div>`;
        return;
    }

    container.innerHTML = events.map(event => `
        <div class="event-item">
            <div>
                <strong>${escapeHtml(event.event_type)}</strong>
                <p>
                    Sensor ID: ${escapeHtml(event.sensor_id)}
                    · Reading ID: ${escapeHtml(event.reading_id ?? "—")}
                </p>
            </div>
            <small>${formatDate(event.occurred_at)}</small>
        </div>
    `).join("");
}

/* Open and close sensor details */

function openSensorDetails(sensorId) {
    selectedSensorId = String(sensorId);

    renderSensorDetails();

    const panel = document.getElementById("sensor-details");
    panel.hidden = false;

    panel.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function closeSensorDetails() {
    selectedSensorId = null;
    document.getElementById("sensor-details").hidden = true;
}

function renderSensorDetails() {
    if (selectedSensorId === null) return;

    const sensor = dashboardData.sensors.find(
        item => String(item.id) === selectedSensorId
    );

    if (!sensor) {
        closeSensorDetails();
        return;
    }

    const readings = getSensorReadings(sensor.id);
    const latestReading = readings.length
        ? readings[readings.length - 1]
        : null;

    const status = getSensorStatus(sensor, latestReading);
    const unit = sensor.unit ?? "";

    setText(
        "detail-title",
        sensor.name ?? sensor.sensor_code
    );

    setText(
        "detail-subtitle",
        `${sensor.sensor_code} · ${sensor.measurement_type}`
    );

    setText(
        "detail-value",
        latestReading
            ? `${latestReading.value} ${unit}`
            : "No readings"
    );

    setText(
        "detail-time",
        latestReading
            ? formatDate(latestReading.received_at)
            : "No measurement available"
    );

    setText(
        "detail-min",
        sensor.min_threshold !== null &&
        sensor.min_threshold !== undefined
            ? `${sensor.min_threshold} ${unit}`
            : "Not configured"
    );

    setText(
        "detail-max",
        sensor.max_threshold !== null &&
        sensor.max_threshold !== undefined
            ? `${sensor.max_threshold} ${unit}`
            : "Not configured"
    );

    setText("detail-status", status);

    const statusDescriptions = {
        "Normal": "The latest measurement is within the configured limits.",
        "Alarm": "The latest measurement is outside the configured limits. The sensor requires attention.",
        "Inactive": "This sensor is currently marked as inactive.",
        "No readings": "The sensor has not reported any measurements yet."
    };

    setText(
        "detail-status-text",
        status === "Normal" ? "Operating normally" : "Requires review"
    );

    setText(
        "detail-explanation",
        statusDescriptions[status]
    );

    renderSensorChart(sensor, readings);
    renderMeasurementHistory(sensor, readings);
}

/* Draw measurement history as an SVG graph */

function renderSensorChart(sensor, readings) {
    const container = document.getElementById("sensor-chart");

    const validReadings = readings.filter(
        reading =>
            reading.value !== null &&
            reading.value !== undefined &&
            Number.isFinite(Number(reading.value))
    );

    if (!validReadings.length) {
        container.innerHTML = `
            <p class="empty-state">
                No measurements available for this sensor yet.
            </p>`;
        return;
    }

    const values = validReadings.map(
        reading => Number(reading.value)
    );

    const minThreshold = Number(sensor.min_threshold);
    const maxThreshold = Number(sensor.max_threshold);

    const hasMin = sensor.min_threshold !== null &&
        sensor.min_threshold !== undefined &&
        Number.isFinite(minThreshold);

    const hasMax = sensor.max_threshold !== null &&
        sensor.max_threshold !== undefined &&
        Number.isFinite(maxThreshold);

    let minValue = Math.min(...values);
    let maxValue = Math.max(...values);

    if (hasMin) minValue = Math.min(minValue, minThreshold);
    if (hasMax) maxValue = Math.max(maxValue, maxThreshold);

    if (minValue === maxValue) {
        minValue -= 1;
        maxValue += 1;
    }

    const padding = (maxValue - minValue) * 0.12;
    minValue -= padding;
    maxValue += padding;

    const width = 800;
    const height = 250;
    const left = 55;
    const right = 20;
    const top = 25;
    const bottom = 38;

    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;

    function xPosition(index) {
        if (validReadings.length === 1) {
            return left + chartWidth / 2;
        }

        return left + (index / (validReadings.length - 1)) * chartWidth;
    }

    function yPosition(value) {
        return top +
            ((maxValue - value) / (maxValue - minValue)) * chartHeight;
    }

    const points = validReadings.map((reading, index) => ({
        x: xPosition(index),
        y: yPosition(Number(reading.value)),
        value: Number(reading.value)
    }));

    const line = points.map(
        point => `${point.x},${point.y}`
    ).join(" ");

    const gridLines = [0, 1, 2, 3].map(index => {
        const y = top + (chartHeight / 3) * index;
        const value = maxValue -
            ((maxValue - minValue) / 3) * index;

        return `
            <line
                x1="${left}" y1="${y}"
                x2="${width - right}" y2="${y}"
                class="chart-grid"
            />
            <text
                x="${left - 9}" y="${y + 4}"
                text-anchor="end"
                class="chart-label"
            >${value.toFixed(1)}</text>
        `;
    }).join("");

    const thresholdLines = `
        ${hasMin ? `
            <line
                x1="${left}" y1="${yPosition(minThreshold)}"
                x2="${width - right}" y2="${yPosition(minThreshold)}"
                class="chart-threshold"
            />
        ` : ""}
        ${hasMax ? `
            <line
                x1="${left}" y1="${yPosition(maxThreshold)}"
                x2="${width - right}" y2="${yPosition(maxThreshold)}"
                class="chart-threshold"
            />
        ` : ""}
    `;

    const circles = points.map(point => `
        <circle
            cx="${point.x}"
            cy="${point.y}"
            r="4"
            class="chart-point"
        >
            <title>${point.value} ${escapeHtml(sensor.unit)}</title>
        </circle>
    `).join("");

    const firstDate = formatDate(validReadings[0].received_at);
    const lastDate = formatDate(
        validReadings[validReadings.length - 1].received_at
    );

    container.innerHTML = `
        <svg
            viewBox="0 0 ${width} ${height}"
            role="img"
            aria-label="Sensor measurement history"
            xmlns="http://www.w3.org/2000/svg"
        >
            ${gridLines}
            ${thresholdLines}

            <polyline
                points="${line}"
                class="chart-line"
            />

            ${circles}

            <text
                x="${left}"
                y="${height - 8}"
                class="chart-label"
            >${escapeHtml(firstDate)}</text>

            <text
                x="${width - right}"
                y="${height - 8}"
                text-anchor="end"
                class="chart-label"
            >${escapeHtml(lastDate)}</text>
        </svg>
    `;
}

/* Show the latest 10 measurements */

function renderMeasurementHistory(sensor, readings) {
    const container = document.getElementById("detail-history");

    const latestReadings = [...readings].reverse().slice(0, 10);

    if (!latestReadings.length) {
        container.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
                    No measurements available.
                </td>
            </tr>`;
        return;
    }

    container.innerHTML = latestReadings.map(reading => {
        const status = getSensorStatus(sensor, reading);

        return `
            <tr>
                <td>${escapeHtml(sensor.measurement_type)}</td>
                <td>
                    <strong>
                        ${escapeHtml(reading.value)}
                        ${escapeHtml(sensor.unit)}
                    </strong>
                </td>
                <td>${formatDate(reading.received_at)}</td>
                <td>
                    <span class="status ${getStatusClass(status)}">
                        ${escapeHtml(status)}
                    </span>
                </td>
            </tr>
        `;
    }).join("");
}

/* Refresh all dashboard data */

async function refreshDashboard() {
    if (refreshInProgress) return;

    refreshInProgress = true;

    try {
        const [
            sensors,
            readings,
            anomalies,
            notifications,
            events
        ] = await Promise.all([
            fetchData("/sensors"),
            fetchData("/readings?limit=500"),
            fetchData("/anomalies?limit=100"),
            fetchData("/notifications?limit=100"),
            fetchData("/events?limit=100")
        ]);

        dashboardData = {
            sensors,
            readings,
            anomalies,
            notifications,
            events
        };

        setText(
            "sensor-count",
            sensors.filter(sensor => sensor.is_active).length
        );

        setText("reading-count", readings.length);
        setText("anomaly-count", anomalies.length);

        setText(
            "notification-count",
            notifications.filter(item => !item.acknowledged).length
        );

        renderSensors(sensors);
        renderAlarms(notifications);
        renderEvents(events);

        // Keep an open sensor detail view updated too.
        if (selectedSensorId !== null) {
            renderSensorDetails();
        }

        setText("connection-status", "Connected");

        setText(
            "last-updated",
            `Last updated: ${new Date().toLocaleTimeString("da-DK")}`
        );

    } catch (error) {
        console.error("Dashboard update failed:", error);

        setText("connection-status", "Connection error");
        setText("last-updated", "Could not retrieve API data");

    } finally {
        refreshInProgress = false;
    }
}

/* Click a sensor row to open its details */

document.getElementById("sensor-table").addEventListener(
    "click",
    event => {
        const row = event.target.closest(".sensor-row");

        if (row) {
            openSensorDetails(row.dataset.sensorId);
        }
    }
);

document.getElementById("sensor-table").addEventListener(
    "keydown",
    event => {
        if (event.key !== "Enter" && event.key !== " ") return;

        const row = event.target.closest(".sensor-row");

        if (row) {
            event.preventDefault();
            openSensorDetails(row.dataset.sensorId);
        }
    }
);

document.getElementById("close-details").addEventListener(
    "click",
    closeSensorDetails
);

// Initial load and automatic refresh every five seconds.
refreshDashboard();
setInterval(refreshDashboard, 5000);
