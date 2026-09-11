/**
 * --- ADMIN CHARTS COMPONENT (admin-charts.js) ---
 * Chart.js alapú vizuális kör- és fánkdiagramok generálása és frissítése.
 */

let chartDistances = null;
let chartStatus = null;

export function renderAdminCharts() {
    const rm = window.raceManager;
    if (!rm || !rm.data.racers) return;

    const ctxDist = document.getElementById('chart-distances');
    const ctxStat = document.getElementById('chart-status');

    if (!ctxDist || !ctxStat || typeof Chart === 'undefined') return;

    const racers = rm.data.racers;

    const distCount = { '22km': 0, '11km': 0, '4km': 0 };
    racers.forEach(r => {
        if (distCount[r.distance] !== undefined) distCount[r.distance]++;
    });

    const distData = {
        labels: ['22km Hosszú', '11km Rövid', '4km SUP'],
        datasets: [
            {
                data: [distCount['22km'], distCount['11km'], distCount['4km']],
                backgroundColor: ['#00A3FF', '#FF4D4D', '#00FFCC'],
                borderWidth: 0,
            },
        ],
    };

    const statCount = { registered: 0, running: 0, finished: 0 };
    racers.forEach(r => {
        if (statCount[r.status] !== undefined) statCount[r.status]++;
    });

    const statData = {
        labels: ['Regisztrált (Vár)', 'Futó (Pályán)', 'Befutott'],
        datasets: [
            {
                data: [statCount['registered'], statCount['running'], statCount['finished']],
                backgroundColor: ['#555555', '#00A3FF', '#00FFCC'],
                borderWidth: 0,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'right', labels: { color: 'white' } },
        },
    };

    if (chartDistances) {
        chartDistances.data = distData;
        chartDistances.update();
    } else {
        chartDistances = new Chart(ctxDist, { type: 'doughnut', data: distData, options: chartOptions });
    }

    if (chartStatus) {
        chartStatus.data = statData;
        chartStatus.update();
    } else {
        chartStatus = new Chart(ctxStat, { type: 'pie', data: statData, options: chartOptions });
    }
}
