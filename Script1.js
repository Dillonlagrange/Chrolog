const projectsContainer = document.getElementById("projectsContainer");
const addTimerBtn = document.getElementById("addTimerBtn");
const rows = []; // Correct: Global array for row objects
let activeTimer = null; // Correct: Global variable for active timer

const timerColumnHeaders = document.createElement("div");
timerColumnHeaders.id = "timer-column-headers"; // Give it an ID for your CSS to target

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
    .then(() => console.log('Service Worker registered'))
    .catch(error => console.error('Service Worker registration failed:', error));
}

// Populate the header with labels. The order and placeholders should match
// the columns in your dynamically created .project-row elements.
timerColumnHeaders.innerHTML = `
    <span class="header-label project-name-label">Project Name</span>
    <span class="header-label toggle-button-label"></span>
    <span class="header-label start-time-label">Start Time</span>
    <span class="header-label end-time-label">End Time</span>
    <span class="header-label elapsed-time-label">Elapsed Time</span>
    <span class="header-label reset-button-label"></span>
    <span class="header-label delete-button-label"></span> `;

// Insert the new header element into the DOM, right before projectsContainer
// projectsContainer.parentNode refers to <div class="frame" id="today">
// Ensure projectsContainer exists before trying to access its parentNode
if (projectsContainer) {
    projectsContainer.parentNode.insertBefore(timerColumnHeaders, projectsContainer);
} else {
    console.error("Element with ID 'projectsContainer' not found. Cannot insert timerColumnHeaders.");
}


const totalTimeTodayDisplay = document.getElementById("totalTimeTodayDisplay");
// Check if totalTimeTodayDisplay element exists
if (!totalTimeTodayDisplay) {
    console.error("Element with ID 'totalTimeTodayDisplay' not found.");
    // You might want to create it or handle this error appropriately
}


function formatTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const pad = (num) => String(num).padStart(2, '0');

    if (hours > 0) {
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    } else {
        return `${pad(minutes)}:${pad(seconds)}`;
    }
}

function formatTimeWithAmPm(date) {
    if (!date) return "00:00 AM"; // Handle null/undefined dates
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // The hour '0' (midnight) should be '12'
    const strMinutes = String(minutes).padStart(2, '0');
    return `${hours}:${strMinutes} ${ampm}`;
}

function parseTime(timeStr) {
    if (!timeStr) return null;

    // Try parsing "HH:MM AM/PM" format
    const ampmMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (ampmMatch) {
        let [_, h, m, ampm] = ampmMatch;
        h = parseInt(h);
        m = parseInt(m);
        if (ampm.toUpperCase() === 'PM' && h < 12) h += 12;
        // FIX: Typo 'amppm' should be 'ampm'
        if (ampm.toUpperCase() === 'AM' && h === 12) h = 0; // 12 AM (midnight) is 0 hours
        const d = new Date();
        d.setHours(h, m, 0, 0);
        return d;
    }

    // If not AM/PM, try "HH:MM" (24-hour) format
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        const d = new Date();
        d.setHours(parts[0], parts[1], 0, 0);
        return d;
    }

    return null; // Could not parse
}

// Function to calculate and update total time display for today
function updateTotalTimeTodayDisplay() {
    let totalElapsedSeconds = 0;
    const todayTimersData = JSON.parse(localStorage.getItem('todayTimers') || '[]');

    todayTimersData.forEach(timer => {
        if (typeof timer.accumulatedSeconds === 'number') {
            totalElapsedSeconds += timer.accumulatedSeconds;
        }
        // If a timer is currently running, also add its current session's elapsed time
        if (timer.isRunning && timer.lastKnownTimestamp) {
            totalElapsedSeconds += Math.floor((Date.now() - timer.lastKnownTimestamp) / 1000);
        }
    });

    // Ensure totalTimeTodayDisplay element exists before trying to set its textContent
    if (totalTimeTodayDisplay) {
        totalTimeTodayDisplay.textContent = formatTime(totalElapsedSeconds);
    } else {
        console.error("Element with ID 'totalTimeTodayDisplay' not found.");
    }
    return totalElapsedSeconds;
}

function createProjectRow(savedData = {}) {
    const row = document.createElement("div");
    row.className = "project-row";

    const projectInput = document.createElement("input");
    projectInput.type = "text";
    projectInput.placeholder = "Project name";
    projectInput.value = savedData.projectName || "";

    const startTimeInput = document.createElement("span");
    startTimeInput.className = "time-display-output";
    startTimeInput.textContent = savedData.startTime ? formatTimeWithAmPm(parseTime(savedData.startTime)) : "00:00 AM";

    const timerDisplay = document.createElement("span");
    timerDisplay.className = "timer-display";
    timerDisplay.textContent = "00:00:00"; // Placeholder

    const endTimeInput = document.createElement("span");
    endTimeInput.className = "time-display-output";
    endTimeInput.textContent = savedData.endTime ? formatTimeWithAmPm(parseTime(savedData.endTime)) : "00:00 AM";

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "✕";
    deleteBtn.classList.add("delete-timer-btn");

    deleteBtn.onclick = () => {
        // FIX: Declare index here to ensure correct scope
        const index = rows.findIndex(r => r.row === row);
        if (index !== -1) { // Ensure the row exists in the array
            if (rowObject.timerInterval) {
                rowObject.stopTimer(false); // Stop without cascading for deletion
            }
            rows.splice(index, 1); // Remove from the global 'rows' array
            row.remove(); // Remove from DOM
            saveTodayTimers(); // Updates localStorage after deletion
        }
        // REMOVED: Duplicated splice logic and incorrect index declaration
    };

    let timerInterval = null;
    let currentStartTime = null;
    let accumulatedSeconds = savedData.accumulatedSeconds || 0;
    let isRunning = savedData.isRunning || false;

    const toggleButton = document.createElement("button");
    toggleButton.textContent = "Start";
    toggleButton.className = "start-button";

    function updateTimerDisplay() {
        let totalSeconds = accumulatedSeconds;
        if (isRunning && currentStartTime) {
            totalSeconds += Math.floor((Date.now() - currentStartTime) / 1000);
        }
        // CORRECT: Use .textContent for span
        timerDisplay.textContent = formatTime(totalSeconds);
    }

    function updateEndTime() {
        // FIX: Read from .textContent
        const currentStartTimeText = startTimeInput.textContent;

        // FIX: Check for the placeholder string, not just an empty string for .value
        if (currentStartTimeText === "00:00 AM") {
            endTimeInput.textContent = "00:00 AM"; // Set placeholder for end time
            return;
        }

        let totalSecondsForEndTimeCalculation = accumulatedSeconds;
        if (isRunning && currentStartTime) {
            totalSecondsForEndTimeCalculation += Math.floor((Date.now() - currentStartTime) / 1000);
        }

        // FIX: Parse the text content into a Date object
        const start = parseTime(currentStartTimeText);
        if (!start) { // Handle case where parseTime returns null
            endTimeInput.textContent = "00:00 AM";
            console.error("Failed to parse start time for end time calculation:", currentStartTimeText);
            return;
        }

        const end = new Date(start.getTime() + totalSecondsForEndTimeCalculation * 1000);
        // FIX: Set .textContent with formatted AM/PM time
        endTimeInput.textContent = formatTimeWithAmPm(end);
    }

    function stopTimer(triggerCascade = true) {
        clearInterval(timerInterval);
        timerInterval = null;
        toggleButton.textContent = "Start";
        toggleButton.className = "start-button";
        row.classList.remove("active");

        if (isRunning && currentStartTime) {
            accumulatedSeconds += Math.floor((Date.now() - currentStartTime) / 1000);
        }
        currentStartTime = null;
        isRunning = false;
        updateTimerDisplay(); // Final update of elapsed time

        updateEndTime(); // Final update of end time

        if (triggerCascade) {
            const index = rows.findIndex(r => r.row === row);
            if (index !== -1) {
                updateStartAndEndTimesFrom(index);
            }
        }
        if (activeTimer === rowObject) {
            activeTimer = null;
        }

        const projectName = projectInput.value || "Unnamed Project";
        // FIX: Pass .textContent for saving to history
        saveTimerToHistory(projectName, startTimeInput.textContent, endTimeInput.textContent);
        saveTodayTimers();
    }

    toggleButton.onclick = () => {
        if (!isRunning) {
            rows.forEach(r => {
                if (r && r !== rowObject && r.isRunning) {
                    r.stopTimer(true);
                }
            });

            // CORRECT: Check .textContent for the placeholder
            if (startTimeInput.textContent === "00:00 AM") {
                const now = new Date();
                // CORRECT: Set .textContent with formatted AM/PM time
                startTimeInput.textContent = formatTimeWithAmPm(now);
            }

            toggleButton.textContent = "Stop";
            toggleButton.className = "stop-button";
            row.classList.add("active");

            currentStartTime = Date.now();
            isRunning = true;
            timerInterval = setInterval(() => {
                updateTimerDisplay();
                updateTotalTimeTodayDisplay();
            }, 1000);
            updateTimerDisplay();
            updateTotalTimeTodayDisplay();

            activeTimer = rowObject;
        } else {
            stopTimer(true);
        }
    };

    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Reset";
    resetBtn.classList.add("reset-timer-btn");
    resetBtn.onclick = () => {
        stopTimer(false);
        accumulatedSeconds = 0;
        currentStartTime = null;
        isRunning = false;
        timerDisplay.textContent = "00:00:00"; // CORRECT: .textContent
        startTimeInput.textContent = "00:00 AM"; // CORRECT: .textContent
        endTimeInput.textContent = "00:00 AM"; // CORRECT: .textContent
        saveTodayTimers();
    };

    row.appendChild(projectInput);
    row.appendChild(toggleButton);
    row.appendChild(startTimeInput);
    row.appendChild(endTimeInput);
    row.appendChild(timerDisplay);
    row.appendChild(resetBtn);
    row.appendChild(deleteBtn);

    projectsContainer.appendChild(row);

    const rowObject = {
        row,
        projectInput,
        startTimeInput,
        endTimeInput,
        timerDisplay,
        updateEndTime,
        stopTimer,
        get timerInterval() { return timerInterval; },
        get currentStartTime() { return currentStartTime; },
        get accumulatedSeconds() { return accumulatedSeconds; },
        get isRunning() { return isRunning; },
        set accumulatedSeconds(val) { accumulatedSeconds = val; },
        set isRunning(val) { isRunning = val; },
        startTimer: () => toggleButton.click(),
        updateTimerDisplay
    };
    rows.push(rowObject);

    console.log("createProjectRow called for:", savedData.projectName, "with savedData:", savedData);

    if (savedData.isRunning) {
        if (savedData.lastKnownTimestamp) {
            accumulatedSeconds = savedData.accumulatedSeconds + Math.floor((Date.now() - savedData.lastKnownTimestamp) / 1000);
        } else {
            accumulatedSeconds = savedData.accumulatedSeconds || 0;
        }

        isRunning = true;
        currentStartTime = Date.now();
        timerInterval = setInterval(() => {
            updateTimerDisplay();
            updateTotalTimeTodayDisplay();
        }, 1000);
        toggleButton.textContent = "Stop";
        toggleButton.className = "stop-button";
        row.classList.add("active");
        activeTimer = rowObject;
        console.log(`Resuming running timer: ${savedData.projectName}, accumulated: ${accumulatedSeconds}`);
    } else {
        console.log(`Loading stopped timer: ${savedData.projectName}, accumulated: ${accumulatedSeconds}`);
    }

    updateTimerDisplay(); // Initial display update
    updateEndTime(); // Initial end time update (important if loaded as stopped)

    return rowObject;
}

// NOTE: This function is not used in the provided code, so no changes needed
function parseDurationToSeconds(durationString) {
    const parts = durationString.split(':').map(Number);
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
}

function updateStartAndEndTimesFrom(index) {
    if (index === -1 || index >= rows.length) return;

    rows[index].updateEndTime();
    let lastEndTimeText = rows[index].endTimeInput.textContent;

    // CORRECT: Check if parseTime returns null (meaning it couldn't parse, e.g., "00:00 AM")
    if (!parseTime(lastEndTimeText)) {
        lastEndTimeText = null; // Treat as no valid time to cascade
    }

    for (let i = index + 1; i < rows.length; i++) {
        if (!lastEndTimeText) break;

        // CORRECT: Set .textContent
        rows[i].startTimeInput.textContent = lastEndTimeText;

        rows[i].updateEndTime();
        lastEndTimeText = rows[i].endTimeInput.textContent;

        console.log(`[CASCADE] Row ${i} (${rows[i].projectInput.value}) updated. New Start: ${rows[i].startTimeInput.textContent}, New End: ${rows[i].endTimeInput.textContent}`);

        const projectName = rows[i].projectInput.value || "Unnamed Project";
        const startTime = rows[i].startTimeInput.textContent;
        const endTime = rows[i].endTimeInput.textContent;
        saveTimerToHistory(projectName, startTime, endTime);
    }
}

function saveTodayTimers() {
    const timers = rows.map(r => {
        let currentElapsedSeconds = r.accumulatedSeconds;
        if (r.isRunning && r.currentStartTime) {
            currentElapsedSeconds += Math.floor((Date.now() - r.currentStartTime) / 1000);
        }
        return {
            projectName: r.projectInput.value,
            // CORRECT: Read from .textContent
            startTime: r.startTimeInput.textContent,
            endTime: r.endTimeInput.textContent,
            // CORRECT: Read from .textContent
            duration: r.timerDisplay.textContent,
            accumulatedSeconds: currentElapsedSeconds,
            isRunning: r.isRunning,
            lastKnownTimestamp: r.isRunning ? Date.now() : null
        };
    });

    const today = new Date();
    const todayDateString = today.toISOString().split('T')[0];

    localStorage.setItem("lastSavedTodayDate", todayDateString);
    localStorage.setItem("todayTimers", JSON.stringify(timers));

    const currentDayTotalSeconds = updateTotalTimeTodayDisplay();

    let allDailyTotals = JSON.parse(localStorage.getItem('allDailyCumulativeTotals') || '{}');
    allDailyTotals[todayDateString] = currentDayTotalSeconds;
    localStorage.setItem('allDailyCumulativeTotals', JSON.stringify(allDailyTotals));

    console.log(`[SAVE] Saved today's timers for ${todayDateString}:`, timers);
    console.log(`[SAVE] Daily total for ${todayDateString}: ${formatTime(currentDayTotalSeconds)}`);
}

function loadTodayTimers() {
    const lastSavedDate = localStorage.getItem("lastSavedTodayDate");
    const today = new Date();
    const todayDateString = today.toISOString().split('T')[0];

    console.log(`[LOAD] Loading... Last saved date: ${lastSavedDate}, Current date: ${todayDateString}`);

    if (lastSavedDate !== todayDateString) {
        console.warn("[LOAD] IT'S A NEW DAY! Clearing 'Today' window data.");
        localStorage.setItem("lastSavedTodayDate", todayDateString);
        localStorage.removeItem("todayTimers");

        // Clear existing rows from DOM and array
        const projectsContainer = document.getElementById("projectsContainer");
        if (projectsContainer) projectsContainer.innerHTML = "";
        rows.length = 0;
    }

    const savedTimers = JSON.parse(localStorage.getItem("todayTimers") || "[]");

    if (savedTimers.length > 0) {
        console.log("[LOAD] Found saved timers:", savedTimers);
        savedTimers.forEach(timer => {
            createProjectRow(timer);
        });
    } else {
        if (rows.length === 0) {
            createProjectRow();
            console.log("[LOAD] No saved timers found or it's a new day. Created an initial row.");
        }
    }
    updateTotalTimeTodayDisplay();
}

function saveTimerToHistory(projectName, startTime, endTime) {
    if (!projectName.trim()) {
        console.warn("[HISTORY] Skipped saving Unnamed Project.");
        return;
    }

    const today = new Date();
    // FIX: Use toLocaleDateString without .split('T')[0] for "en-CA"
    const localDate = today.toLocaleDateString("en-CA"); // Should give "YYYY-MM-DD"

    console.log("[HISTORY] Saving to history for date:", localDate);
    let historyData = JSON.parse(localStorage.getItem(localDate) || "[]");

    historyData.push({ projectName, startTime, endTime });
    localStorage.setItem(localDate, JSON.stringify(historyData));
}

// Event listener setup should be inside DOMContentLoaded to ensure elements exist
document.addEventListener('DOMContentLoaded', () => {
    // Ensure these elements are retrieved after the DOM is fully loaded
    const addTimerBtn = document.getElementById("addTimerBtn");
    const projectsContainer = document.getElementById("projectsContainer"); // Already globally defined, but good to ensure consistency
    const totalTimeTodayDisplay = document.getElementById("totalTimeTodayDisplay"); // Already globally defined

    // Add checks for existence of these elements
    if (!addTimerBtn) {
        console.error("Element with ID 'addTimerBtn' not found. Cannot attach event listener.");
        return;
    }
    if (!projectsContainer) {
        console.error("Element with ID 'projectsContainer' not found. Cannot proceed.");
        return;
    }
    if (!totalTimeTodayDisplay) {
        console.error("Element with ID 'totalTimeTodayDisplay' not found. Ensure it exists in your HTML.");
        // This is a warning, as the app might still function, but the total time display won't.
    }

    addTimerBtn.addEventListener("click", () => createProjectRow());

    loadTodayTimers();
});
    // This is where the timer function stops

const projectsListContainer = document.getElementById("projects-list-container");
const addProjectNameBtn = document.getElementById("addProjectNameBtn");

// Function to create a project text field
function createProjectNameInput(value1 = "", value2 = "") {
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.marginBottom = "10px";

    // First input field
    const input1 = document.createElement("input");
    input1.type = "text";
    input1.placeholder = "Project name";
    input1.value = value1;
    input1.classList.add("project-name-input"); // Apply consistent styling

    // Second input field
    const input2 = document.createElement("input");
    input2.type = "text";
    input2.placeholder = "Additional info";
    input2.value = value2;
    input2.classList.add("project-name-input"); // Same styling for consistency

    const removeBtn = document.createElement("button");
removeBtn.textContent = "✕";
removeBtn.classList.add("remove-btn"); // ✅ Assign a class for styling instead

    removeBtn.addEventListener("click", () => {
        wrapper.remove();
        saveProjects(); // Updates localStorage
    });

    input1.addEventListener("input", saveProjects);
    input2.addEventListener("input", saveProjects);

    // Append both inputs and remove button to wrapper
    wrapper.appendChild(input1);
    wrapper.appendChild(input2);
    wrapper.appendChild(removeBtn);
    projectsListContainer.appendChild(wrapper);
}

// Save projects to localStorage
function saveProjects() {
    const rows = Array.from(projectsListContainer.querySelectorAll("div"));
    const projectData = rows.map(row => {
        const inputs = row.querySelectorAll("input[type='text']");
        return { name: inputs[0]?.value || "", details: inputs[1]?.value || "" };
    });

    localStorage.setItem("savedProjects", JSON.stringify(projectData));
}

// Load saved projects on startup or create an initial row
function loadSavedProjects() {
    const saved = JSON.parse(localStorage.getItem("savedProjects") || "[]");

    if (saved.length === 0) {
        createProjectNameInput("", ""); // Ensures at least one empty row exists
    } else {
        saved.forEach(project => createProjectNameInput(project.name, project.details));
    }
}

addProjectNameBtn.addEventListener("click", () => {
    createProjectNameInput();
    saveProjects();
});

// history window

const historyButtonsContainer = document.getElementById("history-buttons");
const historyContentContainer = document.getElementById("history-content"); // This might not be needed if content is dynamically added to tabs

function getLast7Days() {
    const days = [];
    const today = new Date();

    for (let i = 0; i <= 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        // FIX: Remove .split("T")[0] as toLocaleDateString("en-CA") already gives YYYY-MM-DD
        days.push(date.toLocaleDateString("en-CA")); // Format: YYYY-MM-DD
    }

    return days;
}

function loadHistoryTabs() {
    const historyTabsContainer = document.getElementById("history-tabs");
    if (!historyTabsContainer) {
        console.error("Element with ID 'history-tabs' not found. Cannot load history tabs.");
        return;
    }
    historyTabsContainer.innerHTML = ""; // Clear previous tabs

    const last7Days = getLast7Days();

    last7Days.forEach(dateString => {

        const [year, month, day] = dateString.split("-").map(Number);
        const dateObj = new Date(year, month - 1, day); // month - 1 because Date constructor months are 0-indexed

        const formattedDisplayDate = `${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}-${dateObj.getFullYear()}`;

        const header = document.createElement("div");
        header.className = "history-header";
        header.innerHTML = `
            <button class="arrow-btn">
                <span class="material-symbols-outlined">chevron_right</span>
            </button>
            <span class="date">${formattedDisplayDate}</span>
            `; // Use formattedDisplayDate here

        const content = document.createElement("div");
        content.className = "history-content"; // This is the expandable content area

        header.appendChild(content);
        historyTabsContainer.appendChild(header);

        showHistoryForDate(dateString, content);
        const arrowBtn = header.querySelector(".arrow-btn");
        arrowBtn.addEventListener("click", () => toggleHistoryContent(header));
    });
}

function showHistoryForDate(date, container) {
    const savedHistory = JSON.parse(localStorage.getItem(date) || "[]");

    container.innerHTML = ""; // Clear previous content

    const allDailyTotals = JSON.parse(localStorage.getItem('allDailyCumulativeTotals') || '{}');
    const dailyTotalSeconds = allDailyTotals[date] || 0; // Get total for this date, default to 0
    const formattedDailyTotal = formatTime(dailyTotalSeconds); // Use your existing formatTime helper

    const totalDisplayDiv = document.createElement("div");
    totalDisplayDiv.className = "daily-total-display";
    totalDisplayDiv.textContent = `Total: ${formattedDailyTotal}`;
    container.appendChild(totalDisplayDiv); // Add it to the beginning of the history-content div

    // Keep only the most recent instance per project
    const latestProjects = {};
    savedHistory.forEach(timer => {
        // Ensure projectName is a non-empty string and not "Unnamed Project"
        if (timer.projectName && timer.projectName.trim() !== "" && timer.projectName !== "Unnamed Project") {
           latestProjects[timer.projectName] = timer; // Only add to latestProjects if it passes the filter
        }
    });

    const filteredHistory = Object.values(latestProjects); // Get latest entries only

    if (filteredHistory.length === 0) {
        // Only show this message if there are no valid projects
        const noEntryMsg = document.createElement("p");
        noEntryMsg.textContent = `No named projects saved for ${date}.`;
        noEntryMsg.className = "no-history-entry"; // Optional: for styling
        container.appendChild(noEntryMsg);
        return;
    }

    // Sort by start time - now needs to handle "HH:MM AM/PM" using parseTime
    filteredHistory.sort((a, b) => {
        const dateA = parseTime(a.startTime);
        const dateB = parseTime(b.startTime);

        // Handle cases where startTime might be invalid or unparseable
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1; // Invalid A goes after valid B
        if (!dateB) return -1; // Invalid B goes after valid A

        return dateA.getTime() - dateB.getTime(); // Compare timestamps
    });

    filteredHistory.forEach(timer => {
        const entry = document.createElement("div");
        entry.className = "history-entry";
        const startTimeDate = parseTime(timer.startTime);
        const endTimeDate = parseTime(timer.endTime);

        const formattedStartTime = startTimeDate ? formatTimeWithAmPm(startTimeDate) : "Invalid Time";
        const formattedEndTime = endTimeDate ? formatTimeWithAmPm(endTimeDate) : "Invalid Time";

        entry.innerHTML = `
            <span class="project-name">${timer.projectName}</span>
            <span class="start-time">${formattedStartTime}</span>
            <span class="end-time">${formattedEndTime}</span>
        `;

        container.appendChild(entry);
    });
}

function toggleHistoryContent(header) {
    header.classList.toggle("expanded");

    const arrowSpan = header.querySelector(".arrow-btn .material-symbols-outlined");
    if (arrowSpan) {
        if (header.classList.contains("expanded")) {
            arrowSpan.style.transform = "rotate(90deg)"; // Rotate right arrow to point down/right
        } else {
            arrowSpan.style.transform = "rotate(0deg)"; // Reset rotation
        }
    }
}

// Event listener setup should be inside DOMContentLoaded to ensure elements exist
window.addEventListener("DOMContentLoaded", () => {

    const historyTabsContainer = document.getElementById("history-tabs");
    if (!historyTabsContainer) {
        console.error("Element with ID 'history-tabs' not found. History display will not work.");
    }

    loadHistoryTabs();
    loadSavedProjects();
});

const startTimeDate = parseTime(timer.startTime);
const endTimeDate = parseTime(timer.endTime);

const formattedStartTime = startTimeDate ? formatTimeWithAmPm(startTimeDate) : "Invalid Time";
const formattedEndTime = endTimeDate ? formatTimeWithAmPm(endTimeDate) : "Invalid Time";