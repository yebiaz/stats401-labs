console.log("%c lab10.js     v5 (voice + regions + ranking + gaze) ", "background:#1f3864;color:#fff");
// ============================================================================
// Lab 10 - PART I: voice interaction (Tasks 1-5)
//
// The lab's own principle: keep the INPUT METHOD separate from the
// VISUALIZATION FUNCTION.
//
//   speech   ->  handleCommand(text)  ->  window.MAP.*
//   button   ->  handleCommand(text)  ->  window.MAP.*
//   gesture  ->  handleCommand(text)  ->  window.MAP.*   (lab10_gesture.js)
//   gaze     ->  MAP.highlight()                          (lab10_gaze.js)
//
// handleCommand takes a string and has no idea where it came from, so every
// input path runs identical code. A bug in one is a bug in all of them,
// which is the point - they cannot drift apart.
// ============================================================================


// ---------- Task 1: is speech recognition available? ----------
// Chrome and Edge expose it prefixed. Safari and Firefox do not have it, and
// `new SpeechRecognition()` would throw at the top level and kill every line
// below it - including the fallback buttons. Hence the guard.

const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;


if (!SpeechRecognition) {

    d3.select("#voice-support")
        .text("Speech recognition is not available in this browser. " +
              "Open this page in Chrome to use voice, or use the buttons below.");

    d3.select("#voice-button")
        .attr("disabled", true)
        .text("Voice unavailable");

} else {

    recognition = new SpeechRecognition();

    recognition.lang = "en-US";
    recognition.continuous = false;      // one command, then stop
    recognition.interimResults = false;  // only the final transcript


    // ---------- Task 2: start listening, on an explicit click ----------
    // The microphone is never opened on page load.

    d3.select("#voice-button").on("click", function () {

        recognition.start();

        d3.select("#voice-status").text("Listening...");
        d3.select("#voice-action").text("");

        d3.select("#voice-button").attr("disabled", true);
        d3.select("#voice-stop").attr("disabled", null);
    });


    d3.select("#voice-stop").on("click", function () {
        // stop() finishes processing whatever it already heard, so a command
        // you just finished saying still goes through. abort() would discard
        // it. onend fires either way and tidies the UI.
        recognition.stop();
    });


    // ---------- Task 3: read the transcript ----------

    recognition.onresult = function (event) {

        const transcript = event.results[0][0].transcript
            .toLowerCase()
            .trim();

        // Task 5: show what was heard BEFORE acting, so a misrecognition
        // reads as a misrecognition rather than as the map misbehaving.
        d3.select("#voice-status").text(`Heard: "${transcript}"`);

        handleCommand(transcript);
    };


    // ---------- Task 5: failures are shown, never swallowed ----------

    const ERRORS = {
        "not-allowed":   "Microphone blocked. Allow access in Chrome, then press Start again.",
        "no-speech":     "Nothing heard. Press Start and try again.",
        "audio-capture": "No microphone found.",
        "network":       "Speech service unreachable - use the buttons instead.",
        "aborted":       "Listening stopped."
    };

    recognition.onerror = function (e) {
        d3.select("#voice-status")
            .text(ERRORS[e.error] || `Recognition error: ${e.error}`);
    };


    // onend fires however recognition finishes - a result, an error, a
    // timeout, or the Stop button. It is the only place the UI is reset.
    //
    // The status is only cleared when it is still "Listening...". If a
    // command came through, onresult has already written "Heard: ..." there
    // and that must survive.

    recognition.onend = function () {

        d3.select("#voice-button").attr("disabled", null);
        d3.select("#voice-stop").attr("disabled", true);

        const status = d3.select("#voice-status");

        if (status.text().startsWith("Listening")) {
            status.text("Voice control inactive");
        }
    };
}


// ============================================================================
// Task 4 - map a command string onto a visualization action
//
// Declared OUTSIDE the if/else on purpose: it has nothing to do with speech,
// and the fallback buttons must work even when recognition is unavailable.
// ============================================================================

// The GDP file has no continent column, so regions are listed here by ISO-3.
// Kept in this file rather than the map file because it is a property of the
// COMMAND VOCABULARY, not of the visualization.
const REGIONS = {
    asia: ["CHN", "JPN", "IND", "KOR", "IDN", "SAU", "TWN", "THA", "ISR",
           "SGP", "ARE", "PHL", "MYS", "VNM", "BGD", "HKG", "IRN", "PAK",
           "KAZ", "QAT", "KWT", "IRQ"],
    europe: ["DEU", "GBR", "FRA", "ITA", "ESP", "NLD", "CHE", "POL", "BEL",
             "SWE", "IRL", "AUT", "NOR", "DNK", "ROU", "CZE", "FIN", "PRT",
             "GRC", "HUN", "RUS", "UKR"],
    africa: ["EGY", "ZAF", "NGA", "DZA", "MAR", "ETH", "KEN", "AGO"],
    "north america": ["USA", "CAN", "MEX"],
    "south america": ["BRA", "ARG", "COL", "CHL", "PER", "VEN", "ECU"],
    oceania: ["AUS", "NZL"]
};


// ============================================================================
// RANK NAVIGATION
//
// Walking the fifty countries in GDP order. rankIdx is the position in that
// list: 0 is the largest economy, length-1 the smallest, null means nothing
// is selected yet.
//
// This lives HERE rather than in the gesture file because three inputs need
// it - the buttons, voice, and the sideways-thumb gestures - and they must
// share one position in the list. Moving it here is what makes the arrow
// buttons and the thumb gestures continue each other instead of each keeping
// their own private counter.
// ============================================================================

let rankIdx = null;

function rankedList() {
    return (window.MAP && MAP.ranked) ? MAP.ranked() : [];
}

function showRank(idx, how) {

    const list = rankedList();
    if (!list.length) return;

    rankIdx = Math.max(0, Math.min(list.length - 1, idx));

    const iso = list[rankIdx];
    if (window.GAZE) GAZE.release();
    MAP.highlight(iso);

    const name = MAP.nameOf ? MAP.nameOf(iso) : iso;
    const gdp = MAP.gdpOf ? MAP.gdpOf(iso) : null;

    d3.select("#voice-action").attr("class", "vaction").html(
        `${how}: <b>${name}</b> &mdash; rank ${rankIdx + 1} of ${list.length}` +
        (gdp != null ? ` &middot; $${d3.format(",.0f")(gdp)}bn` : "")
    );
    updateRankButtons();
}

function stepRank(delta, how) {

    const list = rankedList();
    if (!list.length) return;

    // Nothing selected yet: the first step starts at the appropriate end
    // rather than doing nothing.
    if (rankIdx === null) {
        showRank(delta > 0 ? 0 : list.length - 1, how);
        return;
    }

    const next = rankIdx + delta;

    // Clamp at both ends - no wrapping, so the extremes stay meaningful.
    if (next < 0) {
        showLimit("Already at the largest economy - nothing bigger.");
        return;
    }
    if (next >= list.length) {
        showLimit("Already at the smallest of the fifty - nothing smaller.");
        return;
    }

    showRank(next, how);
}

// Grey out an arrow when there is nowhere left to go, so the limit is
// visible before it is hit rather than only reported afterwards.
function updateRankButtons() {
    const n = rankedList().length;
    d3.select("#rank-bigger")
        .attr("disabled", rankIdx !== null && rankIdx === 0 ? true : null);
    d3.select("#rank-smaller")
        .attr("disabled", rankIdx !== null && rankIdx === n - 1 ? true : null);
}


function handleCommand(command) {

    // The map lives inside lab9_map.js's .then(), so window.MAP only exists
    // once the data has loaded. If it is still missing a few seconds in,
    // something is actually wrong rather than slow.
    if (!window.MAP) {
        showAction(
            "The map has not loaded. Check the console for a failed request " +
            "to ../data/ , and that lab9_map.js ends with the window.MAP block."
        );
        console.warn("handleCommand called but window.MAP is undefined.");
        return;
    }

    // "reset" first: it should win even if the sentence contains another
    // keyword by accident.
    if (command.includes("reset") || command.includes("clear")) {
        rankIdx = null;
        updateRankButtons();
        if (window.GAZE) GAZE.release();
        MAP.reset();
        showAction("Reset - highlight cleared, zoom returned to the full map.");
        return;
    }

    // ---- Task 13: gaze indicates the target, voice confirms the action ----
    // A bare "select" / "that one" / "confirm" means "whatever I am looking
    // at". Checked BEFORE the country branch, because "select japan" should
    // still mean Japan - only a bare confirmation reaches the gaze.
    const bare = command.replace(/\b(that|one|it|this|please|ok|okay)\b/g, "").trim();

    if (bare === "select" || bare === "confirm" || bare === "choose" ||
        bare === "pick" || bare === "yes") {

        if (!window.GAZE || !GAZE.active) {
            showCommandError("Gaze tracking is not running, so there is nothing to confirm.");
            return;
        }

        const iso = GAZE.confirm();

        if (iso) {
            showAction(`Confirmed by voice: ${iso} is now locked in.`);
        } else {
            showCommandError(
                "No country has held your gaze long enough yet - look at one " +
                "until the counter reaches 100%, then say \u201cselect\u201d."
            );
        }
        return;
    }

    // ---- colour scale ----
    if (command.includes("log")) {
        MAP.setScale("log");
        showAction("Colour scale: logarithmic - spreads out the smaller economies.");
        return;
    }

    if (command.includes("linear")) {
        MAP.setScale("linear");
        showAction("Colour scale: linear - the largest economies dominate the ramp.");
        return;
    }

    if (command.includes("square root") || command.includes("square") ||
        command.includes("sqrt")) {
        MAP.setScale("sqrt");
        showAction("Colour scale: square root - between linear and logarithmic.");
        return;
    }

    // ---- ranking: checked before countries and regions, because
    // "show the largest" is not a country name. Longest first, so
    // "smallest" is not swallowed by "smaller".
    const list = rankedList();

    if (command.includes("largest") || command.includes("biggest") ||
        command.includes("highest")) {
        showRank(0, "Largest economy");
        return;
    }

    if (command.includes("smallest") || command.includes("lowest")) {
        showRank(list.length - 1, "Smallest of the fifty");
        return;
    }

    if (command.includes("smaller") || command.includes("next down")) {
        stepRank(+1, "Next smaller");
        return;
    }

    if (command.includes("bigger") || command.includes("larger") ||
        command.includes("next up")) {
        stepRank(-1, "Next bigger");
        return;
    }

    // ---- region, before country, because "show asia" names a region ----
    const region = Object.keys(REGIONS)
        .find(r => command.includes(r));

    if (region) {
        const codes = REGIONS[region].filter(c => MAP.has(c));
        MAP.highlightMany(codes);
        showAction(
            `Showing ${titleCase(region)} - ${codes.length} of the fifty ` +
            `largest economies are there.`
        );
        return;
    }

    // ---- a single country ----
    if (command.includes("highlight") || command.includes("show") ||
        command.includes("select") || command.includes("find")) {

        const name = command
            .replace("highlight", "")
            .replace("select", "")
            .replace("show", "")
            .replace("find", "")
            .replace("me", "")
            .trim();

        if (!name) {
            showCommandError("No country named.");
            return;
        }

        const iso3 = MAP.lookup(name);

        if (iso3) {
            if (window.GAZE) GAZE.release();
            MAP.highlight(iso3);
            showAction(`Highlighting ${titleCase(name)} in all three maps.`);
        } else {
            showCommandError(
                `“${name}” is not one of the fifty largest economies, ` +
                `or it was misheard.`
            );
        }
        return;
    }

    showCommandError(`Heard “${command}”.`);
}


// ---------- Task 5: say what happened, and what to try ----------

function showAction(text) {
    d3.select("#voice-action")
        .attr("class", "vaction")
        .text(`Action: ${text}`);
}

// Hitting the end of the ranking is not an error - the command was
// understood, there is simply nowhere further to go. It gets its own
// message so it does not read as "not recognized".
function showLimit(text) {
    d3.select("#voice-action")
        .attr("class", "vaction vaction-limit")
        .text(text);
}

function showCommandError(detail) {
    d3.select("#voice-action")
        .attr("class", "vaction vaction-error")
        .html(
            `Command not recognized. ${detail}<br>` +
            `Try: <b>“highlight japan”</b> &middot; ` +
            `<b>“show asia”</b> &middot; ` +
            `<b>“logarithmic”</b> &middot; ` +
            `<b>“reset”</b>`
        );
}

function titleCase(s) {
    return s.replace(/\b\w/g, c => c.toUpperCase());
}


// ============================================================================
// Part C - conventional fallback
//
// Each button carries its command in a data attribute and goes through
// handleCommand, so the mouse path and the voice path are the same path.
// ============================================================================

d3.selectAll("[data-command]").on("click", function () {
    const command = this.getAttribute("data-command");
    d3.select("#voice-status").text(`Button: "${command}"`);
    handleCommand(command);
});


// ============================================================================
// Keyboard: left and right arrows step the ranking
//
// Cheap to add and it makes the ranking reachable without the mouse at all.
// Ignored while a text field has focus, and preventDefault stops the page
// scrolling sideways underneath.
// ============================================================================

d3.select("body").on("keydown.rank", function (event) {

    const tag = (event.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "select" || tag === "textarea") return;

    if (event.key === "ArrowRight") {
        event.preventDefault();
        handleCommand("next smaller");
    } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        handleCommand("next bigger");
    }
});
