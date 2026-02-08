// Mock Alien SDK for local development — remove or disable in production
window.alien = {
  getIdentity: async () => ({
    alienId: "dev_user_" + Math.random().toString(36).substr(2, 8),
    verified: true
  }),
  requestPayment: async ({ to, amount }) => {
    // Simulate payment confirmation dialog
    const confirmed = confirm(`[MOCK] Pay $${amount} to ${to}?`);
    if (confirmed) {
      return { success: true, txId: "mock_tx_" + Date.now() };
    }
    return { success: false, txId: null };
  }
};
