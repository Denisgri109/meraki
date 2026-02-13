import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Dimensions,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { Video, ResizeMode } from 'expo-av';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenBackground, Button, MerakiText, Card } from '../../components/ui';
import { colors, spacing, layout, gradients } from '../../theme';

const { width } = Dimensions.get('window');

interface Lesson {
    id: string;
    title: string;
    description: string | null;
    video_url: string | null;
    video_provider?: string | null;
    duration_minutes: number | null;
    has_homework: boolean;
}

type AcademyStackParamList = {
    Lesson: {
        lesson: Lesson;
        courseId: string;
        instructorId?: string | null;
        instructorName?: string;
    };
    Homework: { lessonId: string };
    Chat: {
        conversationId: string;
        otherUser: { full_name: string | null; avatar_url: string | null; id?: string };
    };
};

// Helper tools for video extraction...
const getYouTubeVideoId = (url: string): string | null => {
    const patterns = [
        /(?:(?:www\.|m\.)?youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
        /youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
};

const getVimeoVideoId = (url: string): string | null => {
    const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    return match ? match[1] : null;
};

const isStreamingUrl = (url: string): 'youtube' | 'vimeo' | 'mux' | null => {
    if (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('m.youtube.com')) return 'youtube';
    if (url.includes('vimeo.com')) return 'vimeo';
    if (url.includes('mux.com') || url.includes('stream.mux.com')) return 'mux';
    return null;
};

const getEmbedUrl = (url: string, provider?: string | null): string | null => {
    let platform = isStreamingUrl(url);
    if (!platform && provider) {
        if (['youtube', 'vimeo', 'mux'].includes(provider.toLowerCase())) {
            platform = provider.toLowerCase() as any;
        }
    }
    if (platform === 'youtube') {
        let videoId = getYouTubeVideoId(url);
        if (!videoId && /^[a-zA-Z0-9_-]{11}$/.test(url)) videoId = url;
        if (videoId) return `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&fs=1`;
    }
    if (platform === 'vimeo') {
        let videoId = getVimeoVideoId(url);
        if (!videoId && /^\d+$/.test(url)) videoId = url;
        if (videoId) return `https://player.vimeo.com/video/${videoId}?playsinline=1`;
    }
    if (platform === 'mux') {
        const match = url.match(/stream\.mux\.com\/([a-zA-Z0-9]+)/);
        if (match) return `https://stream.mux.com/${match[1]}.m3u8`;
        if (!match && /^[a-zA-Z0-9]+$/.test(url)) return `https://stream.mux.com/${url}.m3u8`;
    }
    return null;
};

export function LessonScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<RouteProp<AcademyStackParamList, 'Lesson'>>();
    const { user } = useAuth();
    const { lesson, instructorId, instructorName } = route.params;

    const videoRef = useRef<Video>(null);
    const [progress, setProgress] = useState(0);
    const [videoDuration, setVideoDuration] = useState<number>(0);
    const [chatLoading, setChatLoading] = useState(false);

    useEffect(() => {
        loadProgress();
    }, []);

    const loadProgress = async () => {
        if (!user) return;
        try {
            const { data } = await (supabase as any)
                .from('lesson_progress')
                .select('progress_percent')
                .eq('user_id', user.id)
                .eq('lesson_id', lesson.id)
                .single();
            if (data) setProgress(data.progress_percent);
        } catch (error) {
            console.error('Error loading progress:', error);
        }
    };

    const updateProgress = async (percent: number) => {
        if (!user) return;
        try {
            await (supabase as any)
                .from('lesson_progress')
                .upsert({
                    user_id: user.id,
                    lesson_id: lesson.id,
                    progress_percent: percent,
                    completed_at: percent === 100 ? new Date().toISOString() : null,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'user_id,lesson_id' });
            setProgress(percent);
        } catch (error) {
            console.error('Error updating progress:', error);
        }
    };

    const handleVideoProgress = (status: any) => {
        if (status.isLoaded && status.durationMillis) {
            if (videoDuration === 0) setVideoDuration(status.durationMillis / 1000);
            const watchedPercent = Math.round((status.positionMillis / status.durationMillis) * 100);
            if (watchedPercent > progress) updateProgress(Math.min(watchedPercent, 100));
        }
    };

    const markComplete = async () => {
        await updateProgress(100);
        Alert.alert('🎉 Lesson Complete!', 'Great job! Keep up the good work.');
    };

    const handleChatOwner = async () => {
        if (!instructorId || !user) {
            Alert.alert('Unavailable', 'This course does not have an instructor assigned to chat with.');
            return;
        }
        setChatLoading(true);
        try {
            const { data: existing } = await (supabase as any)
                .from('conversations')
                .select('id')
                .eq('client_id', user.id)
                .eq('master_id', instructorId)
                .single();
            let conversationId = existing?.id;
            if (!conversationId) {
                const { data: newConv, error } = await (supabase as any)
                    .from('conversations')
                    .insert({ client_id: user.id, master_id: instructorId })
                    .select().single();
                if (error) throw error;
                conversationId = newConv.id;
            }
            navigation.dispatch(
                CommonActions.navigate({
                    name: 'Chat',
                    params: {
                        conversationId,
                        otherUser: { full_name: instructorName || 'Instructor', avatar_url: null, id: instructorId }
                    },
                })
            );
        } catch (error) {
            Alert.alert('Error', 'Failed to start conversation');
        } finally {
            setChatLoading(false);
        }
    };

    const renderVideoPlayer = () => {
        if (!lesson.video_url) {
            return (
                <View style={styles.videoPlaceholder}>
                    <MerakiText style={styles.videoPlaceholderEmoji}>🎬</MerakiText>
                    <MerakiText variant="body" color={colors.textMuted}>Video coming soon</MerakiText>
                </View>
            );
        }
        const embedUrl = getEmbedUrl(lesson.video_url, lesson.video_provider);
        if (embedUrl) {
            const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"><style>* { margin: 0; padding: 0; box-sizing: border-box; } html, body { width: 100%; height: 100%; background: #000; overflow: hidden; } .container { position: relative; width: 100%; height: 100%; } iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; }</style></head><body><div class="container"><iframe src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div></body></html>`;
            return (
                <WebView
                    source={{ html }}
                    style={styles.video}
                    allowsFullscreenVideo
                    allowsInlineMediaPlayback
                    mediaPlaybackRequiresUserAction={false}
                    javaScriptEnabled
                    domStorageEnabled
                    originWhitelist={['*']}
                    scrollEnabled={false}
                />
            );
        }
        return (
            <Video
                ref={videoRef}
                source={{ uri: lesson.video_url }}
                style={styles.video}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                onPlaybackStatusUpdate={handleVideoProgress}
            />
        );
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MerakiText style={styles.backIcon}>←</MerakiText>
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.videoContainer}>
                        {renderVideoPlayer()}
                    </View>

                    <View style={styles.contentPadding}>
                        <Card variant="glass" style={styles.progressCard}>
                            <View style={styles.progressRow}>
                                <MerakiText variant="bodyBold">Lesson Progress</MerakiText>
                                <MerakiText variant="body" color={colors.accent}>{progress}%</MerakiText>
                            </View>
                            <View style={styles.progressBar}>
                                <LinearGradient
                                    colors={gradients.accent as any}
                                    style={[styles.progressFill, { width: `${progress}%` }]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                />
                            </View>
                        </Card>

                        <View style={styles.lessonInfo}>
                            <MerakiText variant="h2" style={styles.lessonTitle}>{lesson.title}</MerakiText>
                            {(videoDuration > 0 || !!lesson.duration_minutes) && (
                                <MerakiText variant="caption" color={colors.textMuted} style={styles.duration}>
                                    ⏱️ {videoDuration > 0 ? (videoDuration < 60 ? `${Math.round(videoDuration)}s` : `${Math.ceil(videoDuration / 60)}m`) : `${lesson.duration_minutes}m`}
                                </MerakiText>
                            )}
                            {lesson.description && (
                                <MerakiText variant="body" color={colors.textSecondary} style={styles.description}>
                                    {lesson.description}
                                </MerakiText>
                            )}
                        </View>

                        <View style={styles.actions}>
                            {progress < 100 && (
                                <Button title="Mark as Complete" onPress={markComplete} variant="primary" style={styles.actionBtn} />
                            )}

                            <TouchableOpacity style={styles.chatButton} onPress={handleChatOwner} disabled={chatLoading}>
                                {chatLoading ? <ActivityIndicator color={colors.primary} /> : (
                                    <>
                                        <MerakiText style={styles.btnIcon}>💬</MerakiText>
                                        <MerakiText variant="bodyBold">Discussion with Instructor</MerakiText>
                                    </>
                                )}
                            </TouchableOpacity>

                            {lesson.has_homework && (
                                <TouchableOpacity
                                    style={styles.homeworkButton}
                                    onPress={() => navigation.navigate('Homework', { lessonId: lesson.id })}
                                >
                                    <LinearGradient colors={gradients.accent as any} style={styles.homeworkGradient}>
                                        <MerakiText style={styles.btnIcon}>📝</MerakiText>
                                        <MerakiText variant="bodyBold" color="#FFF">Submit Homework</MerakiText>
                                    </LinearGradient>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingBottom: 100 },
    header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.surfaceGlass,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    backIcon: { fontSize: 24 },
    videoContainer: {
        width: width,
        height: width * 0.5625,
        backgroundColor: '#000',
        marginBottom: spacing.lg,
    },
    video: { flex: 1 },
    videoPlaceholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface,
    },
    videoPlaceholderEmoji: { fontSize: 48, marginBottom: spacing.md },
    contentPadding: { paddingHorizontal: spacing.lg },
    progressCard: { padding: spacing.md, marginBottom: spacing.xl },
    progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
    progressBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 3 },
    lessonInfo: { marginBottom: spacing.xl },
    lessonTitle: { marginBottom: 4 },
    duration: { marginBottom: spacing.md },
    description: { lineHeight: 22 },
    actions: { gap: spacing.md },
    actionBtn: { marginBottom: spacing.sm },
    chatButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceGlass,
        padding: spacing.md,
        borderRadius: layout.borderRadius.md,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        gap: spacing.sm,
    },
    btnIcon: { fontSize: 18, marginRight: 8 },
    homeworkButton: { borderRadius: layout.borderRadius.md, overflow: 'hidden' },
    homeworkGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.md,
    },
});

export default LessonScreen;
