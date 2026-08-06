// src/services/messageService.js

/**
 * Sends a message to a specific team.
 * @param {object} params - The parameters for sending the message.
 * @param {object} params.supabase - The Supabase client instance.
 * @param {string} params.messageText - The content of the message.
 * @param {string} params.messagingChannelId - The ID of the team to send the message to.
 * @param {string} params.senderDisplay - The display name of the sender.
 * @param {function} params.addToast - Function to display toast notifications.
 * @returns {Promise<object|null>} The new message object or null if an error occurs.
 */
export const sendMessage = async ({ supabase, messageText, messagingChannelId, senderDisplay, addToast }) => {
  if (!messageText.trim() || !messagingChannelId) return null;

  try {
    const { data, error } = await supabase
      .from('team_messages')
      .insert({
        team_id: messagingChannelId,
        sender_name: senderDisplay,
        message_text: messageText.trim()
      })
      .select()
      .single();

    if (error) throw error;
    addToast('Message sent successfully.', 'success');
    return data;
  } catch (err) {
    console.error('Failed to send message:', err);
    addToast('Failed to send message: ' + (err.message || 'Permission denied'), 'error');
    throw err;
  }
};

/**
 * Sends a broadcast message to all teams in the operational period.
 * @param {object} params - The parameters for sending the broadcast.
 * @param {object} params.supabase - The Supabase client instance.
 * @param {string} params.broadcastMessage - The content of the broadcast message.
 * @param {Array<object>} params.teams - List of all teams in the operational period.
 * @param {string} params.responderName - The name of the responder sending the broadcast.
 * @param {function} params.recordAction - Function to record an action in the log.
 * @param {function} params.addToast - Function to display toast notifications.
 * @param {function} params.setBroadcastMessage - Function to clear the broadcast message input.
 * @param {function} params.setShowBroadcastModal - Function to close the broadcast modal.
 */
export const sendBroadcastMessage = async ({
  supabase,
  broadcastMessage,
  teams,
  responderName,
  recordAction,
  addToast,
  setBroadcastMessage,
  setShowBroadcastModal,
}) => {
  if (!broadcastMessage.trim() || teams.length === 0) return;

  try {
    const staffTeam = teams.find(t => t.type === 'Staff');
    if (!staffTeam) throw new Error('No Staff team found to receive broadcast.');

    const { error: broadcastErr } = await supabase.from('team_messages').insert({
      team_id: staffTeam.team_id,
      sender_name: `${responderName} (Broadcast)`,
      message_text: broadcastMessage.trim()
    });

    if (broadcastErr) throw broadcastErr;
    await recordAction(`Sent broadcast message to ${teams.length} teams. Message: "${broadcastMessage.trim()}"`);
    addToast('Broadcast message sent.', 'success');
    setBroadcastMessage('');
    setShowBroadcastModal(false);
  } catch (err) {
    console.error('Failed to send broadcast message:', err);
    addToast(err.message || 'Failed to send broadcast message', 'error');
    throw err;
  }
};