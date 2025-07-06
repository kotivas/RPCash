const {invoke} = window.__TAURI__.core;

// Данные целей
let goals = [];
let activeGoalId = 0;

// Элементы
const tabsEl = document.getElementById('tabs');
const goalTitleEl = document.getElementById('goalTitle');
const progressValueEl = document.getElementById('progressValue');
const savedAmountEl = document.getElementById('savedAmount');
const remainingAmountEl = document.getElementById('remainingAmount');
const goalAmountEl = document.getElementById('goalAmount');
const transactionsListEl = document.getElementById('transactionsList');
const progressFg = document.querySelector('.progress-fg');
const addForm = document.getElementById('addForm');
const amountInput = document.getElementById('amountInput');
const dateInput = document.getElementById('dateInput');
const commentInput = document.getElementById('commentInput');
const newTabBtn = document.getElementById('newTabBtn');

function generateId() {
    return '_' + Math.random().toString(36).substr(2, 9);
}

// fucking hell
function getFormattedMonthName(dateStr, locale) {
    var dateParts = dateStr.split(".");
    var date = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
    var monthA = 'нульяря,января,февраля,марта,апреля,июня,июля,августа,сентября,октября,ноября,декабря'.split(',');
    return date.getDate() + " " + monthA[date.getMonth()];
}

function formatNumberShort(value) {
    const abs = Math.abs(value);

    if (abs >= 1_000_000_000) {
        return (value / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
    }
    if (abs >= 1_000_000) {
        return (value / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (abs >= 1_001) {
        return (value / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    }

    return value.toString();
}


async function saveGoalsToDisk(goals) {
    try {
        const json = JSON.stringify(goals, null, 2);
        await invoke("save_goals", {json});
    } catch (err) {
        console.error("Ошибка сохранения:", err);
    }
}

async function loadGoalsFromDisk() {
    try {
        const json = await invoke("load_goals");
        return JSON.parse(json);
    } catch (err) {
        console.warn("Не удалось загрузить цели, создаю пустой список:", err);
        return [{
            "id": "_newgoaldot",
            "title": "Новая цель",
            "targetAmount": 1000,
            "savedAmount": 0,
            "transactions": []
        }];
    }
}

// Рендер табов
function renderTabs() {
    // Удаляем все табы кроме кнопки новой цели
    [...tabsEl.querySelectorAll('.tab')].forEach(t => t.remove());

    goals.forEach(goal => {
        const tab = document.createElement('div');
        tab.className = 'tab';
        if (goal.id === activeGoalId) tab.classList.add('active');
        tab.dataset.id = goal.id;
        tab.title = goal.title;

        tab.innerHTML = `
        <span class="tab-title">${goal.title}</span>
        <span class="close-btn" title="Удалить цель">&times;</span>
      `;

        tabsEl.insertBefore(tab, newTabBtn);

        // Клик на таб
        tab.addEventListener('click', e => {
            if (e.target.classList.contains('close-btn')) {
                // Закрыть таб
                removeGoal(goal.id);
                e.stopPropagation();
            } else {
                setActiveGoal(goal.id);
            }
        });
    });
}

function setActiveGoal(id) {
    activeGoalId = id;
    renderTabs();
    renderGoal();
}

function removeGoal(id) {
    if (!confirm("Удалить эту цель?")) return;
    const index = goals.findIndex(g => g.id === id);
    if (index === -1) return;
    goals.splice(index, 1);
    if (activeGoalId === id) {
        if (goals.length > 0) {
            activeGoalId = goals[0].id;
        } else {
            // Создать пустую цель
            createNewGoal("Новая цель", 1000);
        }
    }
    renderTabs();
    renderGoal();
    saveGoalsToDisk(goals);
}

function createNewGoal(title, targetAmount) {
    const newGoal = {
        id: generateId(),
        title: title,
        targetAmount: targetAmount,
        savedAmount: 0,
        transactions: []
    };
    goals.push(newGoal);
    activeGoalId = newGoal.id;
    renderTabs();
    renderGoal();
}

// Рендер выбранной цели
function renderGoal() {
    const goal = goals.find(g => g.id === activeGoalId);
    if (!goal) return;

    goalTitleEl.textContent = "🎯 " + goal.title;
    savedAmountEl.textContent = "$" + formatNumberShort(goal.savedAmount);
    goalAmountEl.textContent = "$" + formatNumberShort(goal.targetAmount);

    let remaining = goal.targetAmount - goal.savedAmount;
    if (remaining < 0) remaining = 0;

    remainingAmountEl.textContent = "$" + formatNumberShort(remaining);
    progressValueEl.textContent = "$" + formatNumberShort(goal.savedAmount);

    // if saved amount is negative, so progress circle will just be empty
    let progressPercent = (goal.savedAmount>0? goal.savedAmount : 0) / goal.targetAmount;
    if (progressPercent > 1) progressPercent = 1;
    const dashoffset = 251.2 * (1 - progressPercent);
    progressFg.style.strokeDashoffset = dashoffset;

    // История
    let last_date = "0.0.0000";
    transactionsListEl.innerHTML = "";
    goal.transactions.forEach(tr => {
        const div = document.createElement("div");

        if (last_date !== tr.date) {
            last_date = tr.date;

            const date = document.createElement("div");

            date.classList.add("transaction-date");
            date.innerText = getFormattedMonthName(tr.date, "ru-ru");
            transactionsListEl.appendChild(date);
        }

        div.classList.add("transaction");

        if (tr.amount >= 0) {
            div.innerHTML = `
        <span>${tr.comment}</span>
        <span>+$${formatNumberShort(tr.amount)}</span> `;
        } else if (tr.amount < 0) {
            div.innerHTML = `
        <span>${tr.comment}</span>
        <span style="color:#BA1B1D">-$${formatNumberShort(Math.abs(tr.amount))}</span>`;
        }
        transactionsListEl.appendChild(div);
    });

    // Очистить форму
    amountInput.value = "";
    commentInput.value = "";
}

// Добавление новой транзакции
addForm.addEventListener('submit', e => {
    e.preventDefault();
    const amount = parseFloat(amountInput.value);
    const comment = commentInput.value.trim();
    var date = new Date();
    date = date.toLocaleDateString("ru-ru");

    if (isNaN(amount)) {
        alert("Введите корректную сумму.");
        return;
    }

    const goal = goals.find(g => g.id === activeGoalId);
    if (!goal) return;

    // const short_amount = formatNumberShort(amount)
    goal.transactions.unshift({date, amount, comment});
    goal.savedAmount += amount;

    console.log(goal)

    renderGoal();
    saveGoalsToDisk(goals)
});

// Кнопка создать новую цель
newTabBtn.addEventListener('click', () => {
    const title = prompt("Введите название новой цели:", "Новая цель");
    if (!title) return alert("Название цели не может быть пустым.");

    let targetStr = prompt("Введите сумму цели ($):", "1000");
    const targetAmount = parseFloat(targetStr);
    if (isNaN(targetAmount)) {
        return alert("Введите корректную сумму цели.");
    }

    createNewGoal(title.trim(), targetAmount);
    saveGoalsToDisk(goals)
});

// Инициализация

window.addEventListener("DOMContentLoaded", () => {
    loadGoalsFromDisk().then(json => {
        goals = json;
        activeGoalId = goals[0].id;
        renderTabs();
        renderGoal();
    });
});