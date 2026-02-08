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
    const hostUrl = document.getElementById('hostUrl');

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
        
        new QRCode(document.getElementById('qrcode'), {
            text: qrUrl,
            width: 200,
            height: 200,
            colorDark: '#000000',
            colorLight: '#ffffff'
        });

        // Update host URL
        if (window.location.hostname !== 'localhost') {
            hostUrl.textContent = window.location.hostname;
        }

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
                    x: {
                        grid: { color: '#525252', drawBorder: false },
                        ticks: { color: '#c6c6c6', font: { family: 'IBM Plex Mono', size: 12 } }
                    },
                    y: {
                        min: 0, max: 1,
                        grid: { color: '#525252', drawBorder: false },
                        ticks: { 
                            color: '#c6c6c6', 
                            font: { family: 'IBM Plex Mono', size: 12 },
                            callback: function(value) {
                                return Math.round(value * 100) + '%';
                            }
                        }
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
                attendeeCount.textContent = message.count;
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
        const currentColor = interpolateColor(data.avg);
        sentimentChart.data.datasets[0].borderColor = currentColor;
        sentimentChart.data.datasets[0].pointBackgroundColor = currentColor;
        
        sentimentChart.update('none');
    }

    function updateSentimentGauge(value) {
        sentimentGauge.textContent = value.toFixed(2);
        sentimentGauge.style.color = interpolateColor(value);
        
        // Update label
        let label = 'Neutral';
        if (value < 0.2) label = 'Cold';
        else if (value < 0.4) label = 'Cool';
        else if (value < 0.6) label = 'Neutral';
        else if (value < 0.8) label = 'Warm';
        else label = 'Hot';
        
        sentimentLabel.textContent = label;
    }

    function updateTips(total) {
        const formatted = formatCurrency(total);
        totalTips.textContent = formatted;
        totalTipsHeader.textContent = formatted;
    }

    function addTipToFeed(data) {
        // Clear "no tips" message if present
        const noTipsMsg = tipList.querySelector('.helper-01');
        if (noTipsMsg) {
            noTipsMsg.remove();
        }
        
        const tipItem = document.createElement('div');
        tipItem.className = 'tip-feed-item';
        tipItem.innerHTML = `
            <div class="tip-amount">${formatCurrency(data.amount)}</div>
            <div class="helper-01">${formatTime(data.ts)}</div>
        `;
        
        tipList.insertBefore(tipItem, tipList.firstChild);
        
        // Keep only last 10 tips
        while (tipList.children.length > 10) {
            tipList.removeChild(tipList.lastChild);
        }
    }

    function interpolateColor(value) {
        const cold = { r: 69, g: 137, b: 255 };  // #4589ff
        const hot = { r: 218, g: 30, b: 40 };     // #da1e28
        
        const r = Math.round(cold.r + (hot.r - cold.r) * value);
        const g = Math.round(cold.g + (hot.g - cold.g) * value);
        const b = Math.round(cold.b + (hot.b - cold.b) * value);
        
        return `rgb(${r}, ${g}, ${b})`;
    }
});
