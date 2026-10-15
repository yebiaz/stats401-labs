console.log("%c lab10_gaze.js    v4 (smoothing + probe + say-select) ", "background:#6a3d9a;color:#fff");
// ============================================================================
// Lab 10 - PART III: webcam eye gaze (Tasks 11-13)
//
// WebGazer estimates a screen position from webcam face/eye features. The raw
// signal is noisy and biased - vertical accuracy is worse than horizontal, so
// looking low on the page lands high. Three things make it usable:
//
//   1. SMOOTHING   - average the last N estimates instead of trusting one
//   2. PROBING     - sample five points around the estimate, not just one
//   3. GRACE       - a brief drop-out does not reset the dwell clock
//
// Task 13 (Midas touch) is handled two ways: a dwell before anything happens,
// and then "gaze indicates the target, voice confirms the action".
// ============================================================================

const gazeStatus = d3.select("#gaze-status");
const gazeTarget = d3.select("#gaze-target");
const gazeDot    = d3.select("#gaze-cursor");

let gazeOn     = false;
let confirmed  = false;   // once a country is confirmed, gaze stops steering

const DWELL_MS  = 800;    // how long a country must hold the gaze
const GRACE_MS  = 350;    // how long a drop-out is forgiven
const SMOOTH_N  = 8;      // estimates averaged together
const PROBE_PX  = 26;     // how far out the extra sample points sit


// ---------- 1. smoothing ----------
// A single WebGazer estimate jitters by tens of pixels frame to frame.
// A running mean of the last few is far steadier, at the cost of lagging
// slightly behind a real eye movement - a good trade for a dwell interaction.

const buffer = [];

function smooth(x, y) {
    buffer.push([x, y]);
    if (buffer.length > SMOOTH_N) buffer.shift();
    return [
        d3.mean(buffer, p => p[0]),
        d3.mean(buffer, p => p[1])
    ];
}


// ---------- 2. probing ----------
// elementFromPoint on one pixel is unforgiving: a small country, or an
// estimate landing in the sea between two of them, returns nothing. Sampling
// a cross of five points and taking the most common answer tolerates that.

const PROBE = [[0, 0], [-PROBE_PX, 0], [PROBE_PX, 0], [0, -PROBE_PX], [0, PROBE_PX]];

function isoAt(x, y) {

    const counts = new Map();

    for (const [dx, dy] of PROBE) {
        const iso = isoFromElement(document.elementFromPoint(x + dx, y + dy));
        if (iso) counts.set(iso, (counts.get(iso) || 0) + 1);
    }

    let best = null, bestN = 0;
    counts.forEach((n, iso) => { if (n > bestN) { bestN = n; best = iso; } });
    return best;
}


// Country paths and Dorling circles both carry their iso3 in the bound datum,
// so read it through D3 rather than guessing from the DOM.
function isoFromElement(el) {
    if (!el) return null;
    const d = d3.select(el).datum();
    if (!d) return null;
    if (d.iso3) return d.iso3;                                  // bubble
    if (d.properties && d.properties.iso3 && d.properties.gdp != null) {
        return d.properties.iso3;                               // country path
    }
    return null;
}


// ---------- 3. dwell, with grace ----------

let target  = null;   // the country currently accumulating dwell time
let since   = 0;      // when it started
let lostAt  = 0;      // when it was last briefly lost, 0 if not lost

function gazeListener(data) {

    if (!data || !gazeOn) return;

    const [sx, sy] = smooth(data.x, data.y);
    updateGazeCursor(sx, sy);

    if (confirmed) return;        // a country is pinned; gaze stops steering

    const iso = isoAt(sx, sy);
    const now = Date.now();

    if (iso && iso === target) {
        lostAt = 0;                               // back on target
    } else if (!iso && target && lostAt === 0) {
        lostAt = now;                             // just lost it - start grace
    } else if (!iso && target && now - lostAt < GRACE_MS) {
        // still inside the grace window: keep the clock running
    } else if (iso !== target) {
        target = iso;                             // genuinely a new target
        since  = now;
        lostAt = 0;
        if (!iso) {
            gazeTarget.text("Looking at: (not a country)");
            return;
        }
    }

    if (!target) return;

    const held = now - since;

    if (held < DWELL_MS) {
        const pct = Math.round((held / DWELL_MS) * 100);
        gazeTarget.text(`Looking at ${target} - ${pct}%`);
        return;
    }

    // Dwell satisfied. The country is PREVIEWED, not committed: the lab's
    // rule is gaze indicates, voice or click confirms. Saying "select" calls
    // GAZE.confirm() through the ordinary command handler.
    if (window.MAP) MAP.highlight(target);

    gazeTarget.html(
        `Looking at <b>${target}</b> &mdash; say <b>&ldquo;select&rdquo;</b> ` +
        `to lock it in, or look elsewhere.`
    );
}


// ---------- Task 12: show the estimated gaze point ----------
// Visible feedback is what lets a user understand the estimation error
// rather than conclude the page is broken.

function updateGazeCursor(x, y) {
    gazeDot
        .style("display", "block")
        .style("left", `${x}px`)
        .style("top", `${y}px`);
}


// ---------- the voice/button confirmation half of Task 13 ----------

window.GAZE = {

    // what the eye is currently resting on, or null
    get candidate() {
        return (target && Date.now() - since >= DWELL_MS) ? target : null;
    },

    confirm() {
        const iso = this.candidate;
        if (!iso) return null;

        confirmed = true;
        if (window.MAP) MAP.highlight(iso);

        gazeDot.classed("locked", true);
        gazeTarget.html(`<b>${iso}</b> selected. Say &ldquo;reset&rdquo; to release it.`);
        return iso;
    },

    release() {
        confirmed = false;
        target = null;
        lostAt = 0;
        gazeDot.classed("locked", false);
        if (gazeOn) gazeTarget.text("Released - look at a country again.");
    },

    get active() { return gazeOn; }
};


// ---------- start / stop, on explicit click only ----------

async function startGaze() {

    if (typeof webgazer === "undefined") {
        gazeStatus.text("WebGazer did not load. Check the script tag and your connection.");
        return;
    }

    // WebGazer fetches its face model from a RELATIVE path. If those files
    // are missing, every estimate fails silently, so say so plainly.
    try {
        const probe = await fetch("mediapipe/face_mesh/face_mesh.binarypb",
                                  { method: "HEAD" });
        if (!probe.ok) throw new Error("missing");
    } catch (e) {
        gazeStatus.html(
            "<b>Face-tracking model not found.</b> WebGazer looks for it in " +
            "<code>lab10/mediapipe/face_mesh/</code>. See the setup note above."
        );
        return;
    }

    gazeStatus.text("Starting - allow the camera, then click around to calibrate.");

    webgazer.setGazeListener(gazeListener).begin();

    webgazer.showVideoPreview(true)
            .showPredictionPoints(false)
            .applyKalmanFilter(true);     // WebGazer's own smoothing, on top of ours

    gazeOn = true;
    confirmed = false;
    buffer.length = 0;

    d3.select("#gaze-start").attr("disabled", true);
    d3.select("#gaze-stop").attr("disabled", null);

    gazeStatus.text(
        "Gaze tracking on. Accuracy improves if you click around the page a " +
        "dozen times first - WebGazer calibrates from clicks."
    );
}


function stopGaze() {

    gazeOn = false;
    confirmed = false;
    target = null;
    buffer.length = 0;

    if (typeof webgazer !== "undefined") {
        webgazer.end();                   // releases the camera
        webgazer.showVideoPreview(false);
    }

    gazeDot.style("display", "none").classed("locked", false);
    gazeStatus.text("Gaze tracking off.");
    gazeTarget.text("");

    d3.select("#gaze-start").attr("disabled", null);
    d3.select("#gaze-stop").attr("disabled", true);
}


d3.select("#gaze-start").on("click", startGaze);
d3.select("#gaze-stop").on("click", stopGaze);

window.addEventListener("pagehide", stopGaze);
