// Attendee WebSocket Logic
let ws = null;
let roomId = null;
let alienId = null;
let speakerWallet = null;
let currentSentiment = 0.5;

document.addEventListener('DOMContentLoaded', async () => {
    // Get room ID from URL
    roomId = getUrlParam('room');
    if (!roomId) {
        showToast('No room ID provided');
        return;
    }

    // Get elements
    const roomTitle = document.getElementById('roomTitle');
    const sentimentSlider = document.getElementById('sentimentSlider');
    const sentimentEmoji = document.getElementById('sentimentEmoji');
    const sentimentValue = document.getElementById('sentimentValue');
    const connectionDot = document.getElementById('connectionDot');
    const tipFeed = document.getElementById('tipFeed');
    const tipButtons = document.querySelectorAll('.tip-btn');

    try {
        // Get room info
        const response = await fetch(`/api/rooms/${roomId}`);
        if (!response.ok) {
            throw new Error('Room not found');
        }
        const roomInfo = await response.json();
        roomTitle.textContent = roomInfo.title;
        speakerWallet = roomInfo.speakerWallet;

        // Get identity
        const identity = await AlienBridge.getIdentity();
        alienId = identity.alienId;

        // Create WebSocket connection
        ws = createWebSocket(
            roomId,
            alienId,
            'attendee',
            handleMessage,
            updateConnectionStatus
        );

        // Throttled sentiment update
        const sendSentiment = throttle((value) => {
            if (ws) {
                ws.send({ type: 'sentiment', value });
            }
        }, 500);

        // Sentiment slider handler
        sentimentSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            currentSentiment = value;
            
            // Update UI
            sentimentEmoji.textContent = sentimentToEmoji(value);
            sentimentValue.textContent = `${Math.round(value * 100)}%`;
            sentimentEmoji.style.color = sentimentToColor(value);
            
            // Send to server
            sendSentiment(value);
        });

        // Tip button handlers
        tipButtons.forEach(btn => {
            btn.addEventListener('click', async () => {
                const amount = parseFloat(btn.dataset.amount);
                
                try {
                    // Request payment
                    const paymentResult = await AlienBridge.requestPayment({
                        to: speakerWallet,
                        amount
                    });

                    if (paymentResult.success) {
                        // Send tip to server
                        if (ws) {
                            ws.send({
                                type: 'tip',
                                amount,
                                txId: paymentResult.txId
                            });
                        }
                        
                        // Show confirmation
                        showToast(`✓ Tipped ${formatCurrency(amount)}!`);
                        
                        // Brief button animation
                        btn.style.background = 'var(--tip-highlight)';
                        btn.style.color = 'var(--bg-primary)';
                        setTimeout(() => {
                            btn.style.background = '';
                            btn.style.color = '';
                        }, 500);
                    }
                } catch (error) {
                    console.error('Payment error:', error);
                    // Silent fail or show subtle message
                }
            });
        });

    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Failed to join room. Please try again.');
    }

    function handleMessage(message) {
        switch (message.type) {
            case 'room_info':
                // Room info already fetched, but update if needed
                break;
                
            case 'snapshot':
                // Could update average sentiment display if needed
                break;
                
            case 'tip_event':
                // Add to tip feed
                addTipToFeed(message.amount);
                break;
                
            case 'user_count':
                // Could update attendee count if displayed
                break;
                
            case 'error':
                showToast(message.message);
                break;
        }
    }

    function updateConnectionStatus(status) {
        connectionDot.className = `connection-dot ${status}`;
    }

    function addTipToFeed(amount) {
        const tipItem = document.createElement('div');
        tipItem.className = 'tip-feed-item tip-item';
        tipItem.textContent = `🎉 Someone tipped ${formatCurrency(amount)}!`;
        
        tipFeed.insertBefore(tipItem, tipFeed.firstChild);
        
        // Keep only last 5 tips
        while (tipFeed.children.length > 5) {
            tipFeed.removeChild(tipFeed.lastChild);
        }
        
        // Remove after 10 seconds
        setTimeout(() => {
            if (tipItem.parentNode) {
                tipItem.remove();
            }
        }, 10000);
    }

    // Initialize sentiment display
    sentimentEmoji.textContent = sentimentToEmoji(currentSentiment);
    sentimentValue.textContent = `${Math.round(currentSentiment * 100)}%`;
    sentimentEmoji.style.color = sentimentToColor(currentSentiment);
});
