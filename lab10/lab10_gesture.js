console.log("%c lab10_gesture.js v7 (routes ranking through handleCommand) ", "background:#7a4b2a;color:#fff");
// ============================================================================
// Lab 10 - PART II: camera-based hand gestures (Tasks 6-10)
//
// MediaPipe's GestureRecognizer ships as an ES module, so this file is loaded
// with <script type="module">. It reaches the map through window.MAP and the
// shared handleCommand(), exactly like the voice layer.
//
// Pipeline:  camera frame -> hand landmarks -> gesture -> cooldown
//            -> handleCommand() / MAP -> D3 update
//
// NOTE on how gestures are recognised. MediaPipe's built-in classifier only
// knows eight labels and has no "three fingers", so finger COUNT is computed
// here from the landmarks, and the classifier is used only for the two thumb
// gestures, which it does reliably. It also has no SIDEWAYS thumb, so that
// is measured here too, from the thumb's own direction.
// ============================================================================

import {
    FilesetResolver,
    GestureRecognizer
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";


const video      = document.getElementById("camera");
const camStatus  = d3.select("#camera-status");
const gestureOut = d3.select("#gesture-detected");
const actionOut  = d3.select("#gesture-action");

let recognizer = null;
let stream     = null;
let running    = false;
let starting   = false;
let rafId      = null;
let lastVideoTime = -1;


// ============================================================================
// Task 8 - the gesture vocabulary
// ============================================================================

// Every gesture is just a command string. Nothing here touches the map
// directly: the gesture layer speaks the same vocabulary as voice and the
// buttons, so all three share one rank position and one set of messages.

const ACTIONS = {
    one_finger:    "linear",
    two_fingers:   "logarithmic",
    three_fingers: "square root",

    thumb_up:    "largest",
    thumb_down:  "smallest",

    thumb_right: "next smaller",
    thumb_left:  "next bigger",

    open_palm:   "reset"
};

const LABELS = {
    one_finger:    "One finger",
    two_fingers:   "Two fingers (peace)",
    three_fingers: "Three fingers",
    thumb_up:      "Thumb up",
    thumb_down:    "Thumb down",
    thumb_right:   "Thumb pointing right",
    thumb_left:    "Thumb pointing left",
    open_palm:     "Open palm"
};

// Run the command, then echo whatever the shared handler reported, so the
// gesture panel shows the same outcome text as the voice panel.
function run(name) {
    handleCommand(ACTIONS[name]);
    actionOut
        .attr("class", d3.select("#voice-action").attr("class"))
        .html(`${LABELS[name]} &rarr; ` + d3.select("#voice-action").html());
}


// ============================================================================
// Task 10 - cooldown
//
// A camera reports the same hand thirty times a second. Without this, one
// open palm would fire reset dozens of times. The two stepping gestures get
// a shorter cooldown, so HOLDING a sideways thumb walks through the ranking
// at a steady pace instead of needing a fresh pose for every step.
// ============================================================================

let lastFire = 0;
let lastName = null;

const COOLDOWN_HELD = 1200;
const COOLDOWN_STEP = 800;

function fire(name) {

    const now = Date.now();
    const isStep = (name === "thumb_right" || name === "thumb_left");
    const wait = isStep ? COOLDOWN_STEP : COOLDOWN_HELD;

    // A held gesture repeats after its cooldown, which is what lets a held
    // sideways thumb keep stepping. A different gesture may interrupt
    // sooner, so switching feels responsive.
    if (name === lastName && now - lastFire < wait) return;
    if (now - lastFire < 250) return;

    lastFire = now;
    lastName = name;

    gestureOut.text(`Detected: ${LABELS[name]}`);
    run(name);
}


// ============================================================================
// Finger counting from landmarks
//
// MediaPipe returns 21 points per hand. A finger is "extended" when its tip
// sits above its middle joint (PIP) in the image - y grows downward, so
// tip.y < pip.y. The thumb is excluded: it points sideways, so the same test
// does not apply, and excluding it makes 1/2/3 unambiguous.
//
//   index 8/6    middle 12/10    ring 16/14    pinky 20/18
// ============================================================================

const FINGERS = [[8, 6], [12, 10], [16, 14], [20, 18]];

function extendedCount(lm) {
    let n = 0;
    for (const [tip, pip] of FINGERS) {
        if (lm[tip].y < lm[pip].y - 0.02) n += 1;   // margin kills jitter
    }
    return n;
}


// ============================================================================
// Thumb direction
//
// MediaPipe has Thumb_Up and Thumb_Down but no sideways thumb, so the thumb's
// own direction is measured from its base joint (landmark 2) to its tip (4).
// Using the thumb's own vector rather than its position in the frame makes
// the test independent of where the hand happens to be.
//
// The preview is mirrored with CSS so it reads like a mirror, and the x axis
// is mirrored to match: a thumb pointing to YOUR right returns "thumb_right".
// ============================================================================

function thumbDirection(lm) {

    const base = lm[2], tip = lm[4];

    const dx = tip.x - base.x;
    const dy = tip.y - base.y;

    // Is the thumb actually out, or tucked into the fist? Compare its length
    // against the palm, so the test holds at any distance from the camera.
    const thumbLen = Math.hypot(dx, dy);
    const palm = Math.hypot(lm[9].x - lm[0].x, lm[9].y - lm[0].y);

    if (thumbLen < palm * 0.45) return null;      // tucked in

    // Clearly more sideways than vertical? The 1.2 margin leaves a dead zone
    // at the diagonals, so a tilted thumbs-up is not read as sideways.
    if (Math.abs(dx) > Math.abs(dy) * 1.2) {
        return (-dx) > 0 ? "thumb_right" : "thumb_left";   // -dx = mirrored
    }

    return null;        // vertical enough: let the classifier call up or down
}


// ============================================================================
// Task 7 - load the model
// ============================================================================

async function loadRecognizer() {

    camStatus.text("Loading the hand model (a few MB, first time only)...");

    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );

    recognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/" +
                "gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1
    });
}


// ============================================================================
// Task 6 - the webcam, only on an explicit click
// ============================================================================

async function startCamera() {

    // Guard against a second click while the model is still loading.
    if (starting || running) return;
    starting = true;

    d3.select("#camera-start").attr("disabled", true);

    try {
        if (!recognizer) await loadRecognizer();

        camStatus.text("Requesting camera permission...");

        stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 320, height: 240 }
        });

        video.srcObject = stream;

        // The element has autoplay, so it may already be playing. An
        // AbortError from a redundant play() is harmless.
        try {
            await video.play();
        } catch (e) {
            if (e.name !== "AbortError") throw e;
        }

        running = true;
        camStatus.text("Camera on. Hold a pose steady for about a second.");

        d3.select("#camera-stop").attr("disabled", null);

        detectLoop();

    } catch (err) {
        camStatus.text(`Camera unavailable: ${err.message}`);
        console.warn("camera error", err);
        d3.select("#camera-start").attr("disabled", null);
    } finally {
        starting = false;
    }
}


function stopCamera() {

    running = false;
    starting = false;

    if (rafId) cancelAnimationFrame(rafId);

    if (stream) {
        stream.getTracks().forEach(t => t.stop());   // actually releases it
        stream = null;
    }

    video.srcObject = null;

    camStatus.text("Camera off.");
    gestureOut.text("");

    d3.select("#camera-start").attr("disabled", null);
    d3.select("#camera-stop").attr("disabled", true);
}


// ============================================================================
// The per-frame loop
// ============================================================================

function detectLoop() {

    if (!running) return;

    // Only run the model on a NEW frame. Without this check the same frame
    // is classified repeatedly for no benefit.
    if (video.currentTime !== lastVideoTime && video.readyState >= 2) {

        lastVideoTime = video.currentTime;

        const result = recognizer.recognizeForVideo(video, performance.now());
        const hands = result.landmarks;

        if (hands && hands.length > 0) {

            const lm = hands[0];
            const n = extendedCount(lm);

            if (n >= 4) {
                fire("open_palm");
            } else if (n === 3) {
                fire("three_fingers");
            } else if (n === 2) {
                fire("two_fingers");
            } else if (n === 1) {
                fire("one_finger");
            } else {

                // Fingers curled, so this is a thumb pose. Sideways is
                // measured here; up and down go to the built-in classifier.
                const side = thumbDirection(lm);

                if (side) {
                    fire(side);
                } else {
                    const g = result.gestures[0] && result.gestures[0][0];
                    if (g && g.score > 0.6) {
                        if (g.categoryName === "Thumb_Up")   fire("thumb_up");
                        if (g.categoryName === "Thumb_Down") fire("thumb_down");
                    }
                }
            }
        }
    }

    rafId = requestAnimationFrame(detectLoop);
}


// ============================================================================
// Wiring
// ============================================================================

if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    camStatus.text("This browser cannot access the camera. Use Chrome over https or localhost.");
    d3.select("#camera-start").attr("disabled", true);
} else {
    d3.select("#camera-start").on("click", startCamera);
    d3.select("#camera-stop").on("click", stopCamera);
}

// release the camera if the page is closed or hidden
window.addEventListener("pagehide", stopCamera);
