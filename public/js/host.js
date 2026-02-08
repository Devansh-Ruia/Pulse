// Host Dashboard WebSocket Logic
let ws = null;
let roomId = null;
let alienId = null;
let sentimentChart = null;
let sentimentData = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Get room ID from URL
    roomId = getUrlParam('room');
    if (!roomId) {
        showToast('No room ID provided');
        return;
    }

    // Get elements
    const roomTitle = document.getElementById('roomTitle');
    const roomCode = document.getElementById('roomCode');
    const attendeeCount = document.getElementById('attendeeCount');
    const totalTips = document.getElementById('totalTips');
    const totalTipsHeader = document.getElementById('totalTipsHeader');
    const sentimentGauge = document.getElementById('sentimentGauge');
    const sentimentLabel = document.getElementById('sentimentLabel');
    const tipList = document.getElementById('tipList');
    const roomUrl = document.getElementById('roomUrl');

    try {
        // Get room info
        const response = await fetch(`/api/rooms/${roomId}`);
        if (!response.ok) {
            throw new Error('Room not found');
        }
        const roomInfo = await response.json();
        roomTitle.textContent = roomInfo.title;
        roomCode.textContent = roomId.toUpperCase();

        // Get identity
        const identity = await AlienBridge.getIdentity();
        alienId = identity.alienId;

        // Generate QR code
        const baseUrl = window.location.hostname === 'localhost' 
            ? `http://localhost:3000` 
            : window.location.origin;
        const qrUrl = `${baseUrl}/attend.html?room=${roomId}`;
        
        new QRCode(document.getElementById('qr-container'), {
            text: qrUrl,
            width: 128,
            height: 128,
            colorDark: "#f4f4f4",
            colorLight: "#393939",
            correctLevel: QRCode.CorrectLevel.L
        });

        // Update room URL
        roomUrl.textContent = `${window.location.hostname}/attend.html?room=${roomId}`;

        // Initialize chart
        initializeChart();

        // Create WebSocket connection
        ws = createWebSocket(
            roomId,
            alienId,
            'host',
            handleMessage,
            (status) => {
                console.log('Connection status:', status);
            }
        );

    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Failed to load room. Please try again.');
    }

    function initializeChart() {
        const ctx = document.getElementById('sentimentChart').getContext('2d');
        sentimentChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Average Sentiment',
                    data: [],
                    borderColor: '#4589ff',
                    borderWidth: 2,
                    tension: 0.1,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 300 },
                scales: {
                    y: {
                        min: 0,
                        max: 1,
                        ticks: {
                            stepSize: 0.2,
                            callback: function(value) { return value.toFixed(1); },
                            color: '#c6c6c6',
                            font: { family: 'IBM Plex Mono', size: 12 }
                        },
                        grid: { color: '#525252', drawBorder: false }
                    },
                    x: {
                        ticks: {
                            color: '#c6c6c6',
                            font: { family: 'IBM Plex Mono', size: 12 }
                        },
                        grid: { color: '#525252', drawBorder: false }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#393939',
                        titleColor: '#f4f4f4',
                        bodyColor: '#c6c6c6',
                        borderColor: '#525252',
                        borderWidth: 1,
                        cornerRadius: 0,
                        titleFont: { family: 'IBM Plex Sans', weight: '600' },
                        bodyFont: { family: 'IBM Plex Mono' }
                    }
                },
                elements: {
                    line: { borderColor: '#4589ff', borderWidth: 2, tension: 0.1 },
                    point: { backgroundColor: '#4589ff', radius: 0, hitRadius: 8, hoverRadius: 4 }
                }
            }
        });
    }

    function handleMessage(message) {
        switch (message.type) {
            case 'room_info':
                // Room info already loaded
                break;
                
            case 'snapshot':
                updateSentimentChart(message);
                updateSentimentGauge(message.avg);
                break;
                
            case 'tip_event':
                updateTips(message.totalTips);
                addTipToFeed(message);
                break;
                
            case 'user_count':
                const count = message.count;
                attendeeCount.textContent = count;
                // Update people/person text
                const peopleText = document.querySelector('.dashboard-header .label-01');
                peopleText.textContent = count === 1 ? ' person' : ' people';
                break;
                
            case 'error':
                showToast(message.message);
                break;
        }
    }

    function updateSentimentChart(data) {
        const now = new Date();
        const timeLabel = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        sentimentData.push({
            time: timeLabel,
            value: data.avg,
            timestamp: data.ts
        });

        // Keep only last 60 data points (5 minutes)
        if (sentimentData.length > 60) {
            sentimentData = sentimentData.slice(-60);
        }

        // Update chart
        sentimentChart.data.labels = sentimentData.map(d => d.time);
        sentimentChart.data.datasets[0].data = sentimentData.map(d => d.value);
        
        // Update line color based on current sentiment
        const currentColor = getSentimentColor(data.avg);
        sentimentChart.data.datasets[0].borderColor = currentColor;
        sentimentChart.data.datasets[0].pointBackgroundColor = currentColor;
        
        sentimentChart.update('none');
    }

    function updateSentimentGauge(value) {
        sentimentGauge.textContent = value.toFixed(2);
        sentimentGauge.style.color = getSentimentColor(value);
        
        // Update label
        let label = 'Neutral';
        if (value < 0.2) label = 'Disengaged';
        else if (value < 0.4) label = 'Not feeling it';
        else if (value < 0.6) label = 'Neutral';
        else if (value < 0.8) label = 'Engaged';
        else label = 'Loving it';
        
        sentimentLabel.textContent = label;
    }

    function updateTips(total) {
        const formatted = formatCurrency(total);
        totalTips.textContent = formatted;
        if (totalTipsHeader) {
            totalTipsHeader.textContent = formatted;
        }
    }

    function addTipToFeed(data) {
        // Clear "no tips" message if present
        const noTipsMsg = tipList.querySelector('.helper-01');
        if (noTipsMsg) {
            noTipsMsg.remove();
        }
        
        const tipItem = document.createElement('div');
        tipItem.className = 'tip-entry';
        tipItem.innerHTML = `
            <span class="tip-amount">${formatCurrency(data.amount)}</span>
            <span class="tip-time">${formatTime(data.ts)}</span>
        `;
        
        tipList.insertBefore(tipItem, tipList.firstChild);
        
        // Keep only last 8 visible tips
        while (tipList.children.length > 8) {
            tipList.removeChild(tipList.lastChild);
        }
    }

    function getSentimentColor(value) {
        if (value <= 0.5) {
            // Blue to white
            const t = value / 0.5;
            const r = Math.round(69 + (244 - 69) * t);
            const g = Math.round(137 + (244 - 137) * t);
            const b = Math.round(255 + (244 - 255) * t);
            return `rgb(${r},${g},${b})`;
        } else {
            // White to red
            const t = (value - 0.5) / 0.5;
            const r = Math.round(244 + (218 - 244) * t);
            const g = Math.round(244 + (30 - 244) * t);
            const b = Math.round(244 + (40 - 244) * t);
            return `rgb(${r},${g},${b})`;
        }
    }
});
