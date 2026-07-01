import re

with open('src/components/academy/LessonQAChat.tsx', 'r') as f:
    content = f.read()

# Replace Pinned Messages
pinned_search = """            {/* Pinned Messages */}
            {messages.filter(m => m.is_pinned).length > 0 && (
                <View style={styles.pinnedSection}>
                    {messages.filter(m => m.is_pinned).map(msg => (
                        <View key={msg.id} style={styles.pinnedItem}>
                            <MaterialIcons name="push-pin" size={14} color={colors.accent} />
                            <MerakiText variant="caption" color={colors.textSecondary} numberOfLines={2} style={{ flex: 1, marginLeft: 6 }}>
                                <MerakiText variant="caption" color={colors.accent}>{msg.sender?.full_name}: </MerakiText>
                                {msg.content || '📷 Photo'}
                            </MerakiText>
                        </View>
                    ))}
                </View>
            )}"""

pinned_replace = """            {/* Pinned Messages */}
            <QAPinnedMessages messages={messages} />"""

content = content.replace(pinned_search, pinned_replace)

# Replace Empty State
empty_search = """                {messages.length === 0 ? (
                    <View style={styles.emptyChat}>
                        <MaterialCommunityIcons name="frequently-asked-questions" size={40} color={colors.textMuted} style={{ opacity: 0.3 }} />
                        <MerakiText variant="bodyBold" color={colors.textSecondary} style={{ marginTop: spacing.md, textAlign: 'center' }}>
                            {isInstructor
                                ? 'Student questions will appear here.'
                                : 'Have a question?'}
                        </MerakiText>
                        <MerakiText variant="body" color={colors.textMuted} style={{ marginTop: spacing.xs, textAlign: 'center', lineHeight: 20 }}>
                            {isInstructor
                                ? 'You\\'ll be notified when a student submits a question.'
                                : 'Ask anything about this lesson — attach images if needed. We\\'ll get back to you as soon as possible!'}
                        </MerakiText>
                    </View>
                ) : ("""

empty_replace = """                {messages.length === 0 ? (
                    <QAEmptyState isInstructor={isInstructor} />
                ) : ("""

content = content.replace(empty_search, empty_replace)

# Replace Reply Bar
reply_search = """            {/* Reply Bar */}
            {replyTo && (
                <View style={styles.replyBar2}>
                    <View style={styles.replyContent}>
                        <View style={styles.replyAccent} />
                        <View style={{ flex: 1 }}>
                            <MerakiText variant="caption" color={colors.accent}>
                                Replying to {replyTo.sender?.full_name || 'message'}
                            </MerakiText>
                            <MerakiText variant="caption" color={colors.textMuted} numberOfLines={1}>
                                {replyTo.content || '📷 Photo'}
                            </MerakiText>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={() => setReplyTo(null)}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel reply"
                        accessibilityHint="Cancels replying to the selected message"
                    >
                        <MaterialIcons name="close" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                </View>
            )}"""

reply_replace = """            {/* Reply Bar */}
            {replyTo && (
                <QAReplyBar replyTo={replyTo} setReplyTo={setReplyTo} />
            )}"""

content = content.replace(reply_search, reply_replace)

# Replace Input Bar
input_search = """            {/* Input Bar */}
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.inputBar}>
                    {/* Camera button */}
                    <TouchableOpacity
                        style={styles.mediaBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Upload photo"
                        accessibilityHint="Opens image picker to send a photo"
                        onPress={() => {
                            showModal({
                                title: 'Add Photo',
                                message: 'Choose a source',
                                hideCancel: true,
                                children: (
                                    <View style={{ gap: 10, width: '100%', marginTop: 10 }}>
                                        <TouchableOpacity
                                            style={[styles.actionBtn, { backgroundColor: colors.accent }]}
                                            onPress={() => { hideModal(); takePhoto(); }}>
                                            <MerakiText style={styles.actionBtnText}>Camera</MerakiText>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.actionBtn, { backgroundColor: colors.surfaceLight }]}
                                            onPress={() => { hideModal(); pickImage(); }}>
                                            <MerakiText style={[styles.actionBtnText, { color: colors.text }]}>Gallery</MerakiText>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.actionBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }]}
                                            onPress={hideModal}>
                                            <MerakiText style={[styles.actionBtnText, { color: colors.textSecondary }]}>Cancel</MerakiText>
                                        </TouchableOpacity>
                                    </View>
                                )
                            });
                        }}
                        disabled={imageUploading}
                    >
                        {imageUploading ? (
                            <ActivityIndicator size="small" color={colors.accent} />
                        ) : (
                            <MaterialIcons name="add-a-photo" size={20} color={colors.textSecondary} />
                        )}
                    </TouchableOpacity>

                    <TextInput
                        style={styles.textInput}
                        placeholder={isInstructor ? "Write your answer..." : "Type your question here..."}
                        placeholderTextColor={colors.textMuted}
                        value={messageText}
                        onChangeText={setMessageText}
                        multiline
                        maxLength={1000}
                    />

                    <TouchableOpacity
                        style={[styles.sendBtn, (!messageText.trim() || sending) && styles.sendBtnDisabled]}
                        onPress={() => sendMessage(messageText)}
                        disabled={!messageText.trim() || sending}
                        accessibilityRole="button"
                        accessibilityLabel="Send message"
                        accessibilityHint="Sends your typed message"
                    >
                        {sending ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <MaterialIcons name="send" size={18} color="#FFF" />
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>"""

input_replace = """            {/* Input Bar */}
            <QAInputBar
                isInstructor={isInstructor}
                messageText={messageText}
                setMessageText={setMessageText}
                sending={sending}
                sendMessage={sendMessage}
                imageUploading={imageUploading}
                takePhoto={takePhoto}
                pickImage={pickImage}
                showModal={showModal}
                hideModal={hideModal}
            />"""

content = content.replace(input_search, input_replace)

new_components = """
function QAPinnedMessages({ messages }: { messages: QAMessage[] }) {
    const pinned = messages.filter(m => m.is_pinned);
    if (pinned.length === 0) return null;

    return (
        <View style={styles.pinnedSection}>
            {pinned.map(msg => (
                <View key={msg.id} style={styles.pinnedItem}>
                    <MaterialIcons name="push-pin" size={14} color={colors.accent} />
                    <MerakiText variant="caption" color={colors.textSecondary} numberOfLines={2} style={{ flex: 1, marginLeft: 6 }}>
                        <MerakiText variant="caption" color={colors.accent}>{msg.sender?.full_name}: </MerakiText>
                        {msg.content || '📷 Photo'}
                    </MerakiText>
                </View>
            ))}
        </View>
    );
}

function QAEmptyState({ isInstructor }: { isInstructor: boolean }) {
    return (
        <View style={styles.emptyChat}>
            <MaterialCommunityIcons name="frequently-asked-questions" size={40} color={colors.textMuted} style={{ opacity: 0.3 }} />
            <MerakiText variant="bodyBold" color={colors.textSecondary} style={{ marginTop: spacing.md, textAlign: 'center' }}>
                {isInstructor
                    ? 'Student questions will appear here.'
                    : 'Have a question?'}
            </MerakiText>
            <MerakiText variant="body" color={colors.textMuted} style={{ marginTop: spacing.xs, textAlign: 'center', lineHeight: 20 }}>
                {isInstructor
                    ? "You'll be notified when a student submits a question."
                    : "Ask anything about this lesson — attach images if needed. We'll get back to you as soon as possible!"}
            </MerakiText>
        </View>
    );
}

function QAReplyBar({ replyTo, setReplyTo }: { replyTo: QAMessage, setReplyTo: (msg: QAMessage | null) => void }) {
    return (
        <View style={styles.replyBar2}>
            <View style={styles.replyContent}>
                <View style={styles.replyAccent} />
                <View style={{ flex: 1 }}>
                    <MerakiText variant="caption" color={colors.accent}>
                        Replying to {replyTo.sender?.full_name || 'message'}
                    </MerakiText>
                    <MerakiText variant="caption" color={colors.textMuted} numberOfLines={1}>
                        {replyTo.content || '📷 Photo'}
                    </MerakiText>
                </View>
            </View>
            <TouchableOpacity
                onPress={() => setReplyTo(null)}
                accessibilityRole="button"
                accessibilityLabel="Cancel reply"
                accessibilityHint="Cancels replying to the selected message"
            >
                <MaterialIcons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
        </View>
    );
}

function QAInputBar({
    isInstructor,
    messageText,
    setMessageText,
    sending,
    sendMessage,
    imageUploading,
    takePhoto,
    pickImage,
    showModal,
    hideModal
}: {
    isInstructor: boolean;
    messageText: string;
    setMessageText: (text: string) => void;
    sending: boolean;
    sendMessage: (content: string) => void;
    imageUploading: boolean;
    takePhoto: () => void;
    pickImage: () => void;
    showModal: any;
    hideModal: any;
}) {
    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.inputBar}>
                {/* Camera button */}
                <TouchableOpacity
                    style={styles.mediaBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Upload photo"
                    accessibilityHint="Opens image picker to send a photo"
                    onPress={() => {
                        showModal({
                            title: 'Add Photo',
                            message: 'Choose a source',
                            hideCancel: true,
                            children: (
                                <View style={{ gap: 10, width: '100%', marginTop: 10 }}>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, { backgroundColor: colors.accent }]}
                                        onPress={() => { hideModal(); takePhoto(); }}>
                                        <MerakiText style={styles.actionBtnText}>Camera</MerakiText>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, { backgroundColor: colors.surfaceLight }]}
                                        onPress={() => { hideModal(); pickImage(); }}>
                                        <MerakiText style={[styles.actionBtnText, { color: colors.text }]}>Gallery</MerakiText>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }]}
                                        onPress={hideModal}>
                                        <MerakiText style={[styles.actionBtnText, { color: colors.textSecondary }]}>Cancel</MerakiText>
                                    </TouchableOpacity>
                                </View>
                            )
                        });
                    }}
                    disabled={imageUploading}
                >
                    {imageUploading ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                        <MaterialIcons name="add-a-photo" size={20} color={colors.textSecondary} />
                    )}
                </TouchableOpacity>

                <TextInput
                    style={styles.textInput}
                    placeholder={isInstructor ? "Write your answer..." : "Type your question here..."}
                    placeholderTextColor={colors.textMuted}
                    value={messageText}
                    onChangeText={setMessageText}
                    multiline
                    maxLength={1000}
                />

                <TouchableOpacity
                    style={[styles.sendBtn, (!messageText.trim() || sending) && styles.sendBtnDisabled]}
                    onPress={() => sendMessage(messageText)}
                    disabled={!messageText.trim() || sending}
                    accessibilityRole="button"
                    accessibilityLabel="Send message"
                    accessibilityHint="Sends your typed message"
                >
                    {sending ? (
                        <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                        <MaterialIcons name="send" size={18} color="#FFF" />
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}
"""

components_insert_point = "export function LessonQAChat"
content = content.replace(components_insert_point, new_components + "\n" + components_insert_point)

with open('src/components/academy/LessonQAChat.tsx', 'w') as f:
    f.write(content)
