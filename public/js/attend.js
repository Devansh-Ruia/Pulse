(() => {
  // src/attend.js
  var ws = null;
  var roomId = null;
  var alienId = null;
  var speakerWallet = null;
  var currentSentiment = 0.5;
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      let handleMessage2 = function(message) {
        switch (message.type) {
          case "room_info":
            break;
          case "snapshot":
            break;
          case "tip_event":
            addTipToFeed2(message.amount);
            break;
          case "user_count":
            break;
          case "error":
            showToast(message.message);
            break;
        }
      }, updateConnectionStatus2 = function(status) {
        connectionDot.className = `connection-dot ${status}`;
      }, addTipToFeed2 = function(amount) {
        const noTipsMsg = tipFeed.querySelector(".helper-01");
        if (noTipsMsg) {
          noTipsMsg.remove();
        }
        const tipItem = document.createElement("div");
        tipItem.className = "tip-feed-item";
        tipItem.innerHTML = `
        <div class="tip-amount">${formatCurrency(amount)}</div>
        <div class="helper-01">${formatTime(Date.now())}</div>
      `;
        tipFeed.insertBefore(tipItem, tipFeed.firstChild);
        while (tipFeed.children.length > 10) {
          tipFeed.removeChild(tipFeed.lastChild);
        }
        setTimeout(() => {
          if (tipItem.parentNode) {
            tipItem.remove();
          }
        }, 10000);
      };
      var handleMessage = handleMessage2, updateConnectionStatus = updateConnectionStatus2, addTipToFeed = addTipToFeed2;
      const identity = await window.AlienBridge.init();
      alienId = identity.alienId;
      roomId = getUrlParam("room");
      console.log("Attendee page - room ID from URL:", roomId);
      console.log("Full URL:", window.location.search);
      if (!roomId) {
        showToast("No room ID provided");
        return;
      }
      const roomTitle = document.getElementById("roomTitle");
      const sentimentSlider = document.getElementById("sentimentSlider");
      const sentimentValue = document.getElementById("sentimentValue");
      const connectionDot = document.getElementById("connectionDot");
      const tipFeed = document.getElementById("tipFeed");
      const tipButtons = document.querySelectorAll(".tip-btn");
      try {
        console.log("Fetching room info for:", roomId);
        const response = await fetch(`/api/rooms/${roomId}`);
        console.log("Response status:", response.status);
        if (!response.ok) {
          throw new Error("Room not found");
        }
        const roomInfo = await response.json();
        roomTitle.textContent = roomInfo.title;
        speakerWallet = roomInfo.speakerWallet;
        ws = createWebSocket(
          roomId,
          alienId,
          "attendee",
          handleMessage2,
          updateConnectionStatus2
        );
        const sendSentiment = throttle((value) => {
          if (ws) {
            ws.send({ type: "sentiment", value });
          }
        }, 500);
        sentimentSlider.addEventListener("input", (e) => {
          const value = parseFloat(e.target.value);
          currentSentiment = value;
          sentimentValue.textContent = value.toFixed(2);
          sendSentiment(value);
        });
        tipButtons.forEach((btn) => {
          btn.addEventListener("click", async () => {
            const amount = parseFloat(btn.dataset.amount);
            try {
              const paymentResult = await window.AlienBridge.requestPayment({
                to: speakerWallet,
                amount
              });
              if (paymentResult.success) {
                if (ws) {
                  ws.send({
                    type: "tip",
                    amount,
                    txId: paymentResult.txId
                  });
                }
                showToast(`\u2713 Tipped ${formatCurrency(amount)}!`);
                btn.style.background = "var(--cds-support-success)";
                btn.style.color = "var(--cds-text-on-color)";
                setTimeout(() => {
                  btn.style.background = "";
                  btn.style.color = "";
                }, 300);
              }
            } catch (error) {
              console.error("Payment error:", error);
            }
          });
        });
      } catch (error) {
        console.error("Initialization error:", error);
        showToast("Failed to join room. Please try again.");
      }
      sentimentValue.textContent = currentSentiment.toFixed(2);
    } catch (error) {
      console.error("Initialization error:", error);
      showToast("Failed to join room. Please try again.");
    }
  });
})();
//# sourceMappingURL=attend.js.map
