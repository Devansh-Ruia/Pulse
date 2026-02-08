// Host Dashboard WebSocket Logic
let ws = null;
let roomId = null;
let alienId = null;
let sentimentChart = null;
let sentimentData = [];
let maxDataPoints = 60; // 5 minutes of data (1 point per 5 seconds)

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
    const tipList = document.getElementById('tipList');
    const gaugeValue = document.getElementById('gaugeValue');

    try {
        // Get room info
        const response = await fetch(`/api/rooms/${roomId}`);
        if (!response.ok) {
            throw new Error('Room not found');
        }
        const roomInfo = await response.json();
        roomTitle.textContent = roomInfo.title;
        roomCode.textContent = roomId.toUpperCase();

        // Generate QR code
        const qrUrl = `${window.location.origin}/attend.html?room=${roomId}`;
        new QRCode(document.getElementById('qrcode'), {
            text: qrUrl,
            width: 200,
            height: 200,
            colorDark: '#ffffff',
            colorLight: '#0a0a0f',
            correctLevel: QRCode.CorrectLevel.L
        });

        // Get identity
        const identity = await AlienBridge.getIdentity();
        alienId = identity.alienId;

        // Initialize chart
        initializeChart();

        // Initialize gauge
        drawGauge(0);

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
                    borderColor: '#00d4ff',
                    backgroundColor: 'rgba(0, 212, 255, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4,
                    pointBackgroundColor: '#00d4ff',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(26, 26, 46, 0.9)',
                        titleColor: '#ffffff',
                        bodyColor: '#8888aa',
                        borderColor: '#2a2a3e',
                        borderWidth: 1,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return `Sentiment: ${Math.round(context.parsed.y * 100)}%`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: '#2a2a3e',
                            borderColor: '#2a2a3e'
                        },
                        ticks: {
                            color: '#8888aa',
                            maxRotation: 0
                        }
                    },
                    y: {
                        min: 0,
                        max: 1,
                        grid: {
                            color: '#2a2a3e',
                            borderColor: '#2a2a3e'
                        },
                        ticks: {
                            color: '#8888aa',
                            callback: function(value) {
                                return Math.round(value * 100) + '%';
                            }
                        }
                    }
                },
                animation: {
                    duration: 500
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
                updateGauge(message.avg);
                break;
                
            case 'tip_event':
                updateTips(message);
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

        // Keep only last maxDataPoints
        if (sentimentData.length > maxDataPoints) {
            sentimentData.shift();
        }

        // Update chart
        sentimentChart.data.labels = sentimentData.map(d => d.time);
        sentimentChart.data.datasets[0].data = sentimentData.map(d => d.value);
        
        // Update line color based on sentiment
        const avgSentiment = data.avg;
        const color = sentimentToColor(avgSentiment);
        sentimentChart.data.datasets[0].borderColor = color;
        sentimentChart.data.datasets[0].pointBackgroundColor = color;
        
        sentimentChart.update('none'); // No animation for smooth real-time updates
    }

    function updateGauge(value) {
        const percentage = Math.round(value * 100);
        gaugeValue.textContent = `${percentage}%`;
        gaugeValue.style.color = sentimentToColor(value);
        drawGauge(value);
    }

    function drawGauge(value) {
        const canvas = document.getElementById('gaugeCanvas');
        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height - 10;
        const radius = 80;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw background arc
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, Math.PI, 2 * Math.PI, false);
        ctx.lineWidth = 15;
        ctx.strokeStyle = '#2a2a3e';
        ctx.stroke();

        // Draw value arc
        const startAngle = Math.PI;
        const endAngle = Math.PI + (Math.PI * value);
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngle, false);
        ctx.lineWidth = 15;
        ctx.strokeStyle = sentimentToColor(value);
        ctx.lineCap = 'round';
        ctx.stroke();
    }

    function updateTips(data) {
        const formattedTotal = formatCurrency(data.totalTips);
        totalTips.textContent = formattedTotal;
        totalTipsHeader.textContent = formattedTotal;
    }

    function addTipToFeed(data) {
        // Clear "no tips" message if present
        if (tipList.querySelector('.text-secondary')) {
            tipList.innerHTML = '';
        }

        const tipItem = document.createElement('div');
        tipItem.className = 'tip-item tip-item';
        tipItem.innerHTML = `
            <div>
                <div class="tip-amount">${formatCurrency(data.amount)}</div>
                <div class="tip-time">${formatTime(data.ts)}</div>
            </div>
        `;

        tipList.insertBefore(tipItem, tipList.firstChild);

        // Keep only last 20 tips
        while (tipList.children.length > 20) {
            tipList.removeChild(tipList.lastChild);
        }
    }
});
