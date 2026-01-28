import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Dimensions,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Video, ResizeMode } from 'expo-av';
import { WebView } from 'react-native-webview';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenBackground, Button } from '../../components/ui';
import { colors, spacing } from '../../theme';

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
    Lesson: { lesson: Lesson; courseId: string };
    Homework: { lessonId: string };
};

// Helper to extract YouTube video ID from various URL formats
const getYouTubeVideoId = (url: string): string | null => {
    const patterns = [
        // Standard and mobile youtube URLs with watch?v=
        /(?:(?:www\.|m\.)?youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
        // Short youtu.be URLs
        /youtu\.be\/([a-zA-Z0-9_-]{11})/,
        // Embed URLs
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        // Shorts URLs
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
};

// Helper to extract Vimeo video ID
const getVimeoVideoId = (url: string): string | null => {
    const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    return match ? match[1] : null;
};

// Check if URL is a streaming platform (YouTube, Vimeo, Mux)
const isStreamingUrl = (url: string): 'youtube' | 'vimeo' | 'mux' | null => {
    if (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('m.youtube.com')) return 'youtube';
    if (url.includes('vimeo.com')) return 'vimeo';
    if (url.includes('mux.com') || url.includes('stream.mux.com')) return 'mux';
    return null;
};

// Generate embed URL with provider fallback support
const getEmbedUrl = (url: string, provider?: string | null): string | null => {
    let platform = isStreamingUrl(url);

    // If auto-detection failed but we have a provider, use it
    if (!platform && provider) {
        if (['youtube', 'vimeo', 'mux'].includes(provider.toLowerCase())) {
            platform = provider.toLowerCase() as any;
        }
    }

    if (platform === 'youtube') {
        let videoId = getYouTubeVideoId(url);
        // Allow raw ID if provider is explicitly YouTube
        if (!videoId && /^[a-zA-Z0-9_-]{11}$/.test(url)) videoId = url;

        if (videoId) return `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&fs=1`;
    }

    if (platform === 'vimeo') {
        let videoId = getVimeoVideoId(url);
        // Allow raw ID (digits) if provider is explicitly Vimeo
        if (!videoId && /^\d+$/.test(url)) videoId = url;

        if (videoId) return `https://player.vimeo.com/video/${videoId}?playsinline=1`;
    }

    if (platform === 'mux') {
        const match = url.match(/stream\.mux\.com\/([a-zA-Z0-9]+)/);
        if (match) return `https://stream.mux.com/${match[1]}.m3u8`;
        // Allow raw Mux ID
        if (!match && /^[a-zA-Z0-9]+$/.test(url)) return `https://stream.mux.com/${url}.m3u8`;
    }

    return null;
};

export function LessonScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<RouteProp<AcademyStackParamList, 'Lesson'>>();
    const { user } = useAuth();
    const { lesson, courseId } = route.params;

    const videoRef = useRef<Video>(null);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        loadProgress();
    }, []);

    const loadProgress = async () => {
        if (!user) return;

        try {
            const { data } = await (supabase as any)
                .from('lesson_progress')
                .select('progress_percent, last_position_seconds')
                .eq('user_id', user.id)
                .eq('lesson_id', lesson.id)
                .single();

            if (data) {
                setProgress(data.progress_percent);
            }
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
            const watchedPercent = Math.round((status.positionMillis / status.durationMillis) * 100);
            if (watchedPercent > progress) {
                updateProgress(Math.min(watchedPercent, 100));
            }
        }
    };

    const markComplete = async () => {
        await updateProgress(100);
        Alert.alert('🎉 Lesson Complete!', 'Great job! Keep up the good work.');
    };

    // Render video player based on URL type
    const renderVideoPlayer = () => {
        if (!lesson.video_url) {
            return (
                <View style={styles.videoPlaceholder}>
                    <Text style={styles.videoPlaceholderEmoji}>🎬</Text>
                    <Text style={styles.videoPlaceholderText}>Video coming soon</Text>
                </View>
            );
        }

        // Try to get embed URL using auto-detection OR explicit provider
        const embedUrl = getEmbedUrl(lesson.video_url, lesson.video_provider);

        // If we have an embed URL, it means it's a supported streaming platform (YouTube/Vimeo)
        if (embedUrl) {

            console.log('Loading video embed URL:', embedUrl);

            // Use HTML wrapper with full-size responsive iframe
            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
                        .container { position: relative; width: 100%; height: 100%; }
                        iframe { 
                            position: absolute; 
                            top: 0; left: 0; 
                            width: 100%; height: 100%; 
                            border: none; 
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <iframe 
                            src="${embedUrl}"
                            frameborder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowfullscreen
                        ></iframe>
                    </div>
                </body>
                </html>
            `;

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
                    mixedContentMode="compatibility"
                    scalesPageToFit={true}
                    scrollEnabled={false}
                />
            );
        }

        // Use expo-av Video for direct video URLs (mp4, m3u8, etc.)
        return (
            <Video
                ref={videoRef}
                source={{ uri: lesson.video_url }}
                style={styles.video}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                isLooping={false}
                onPlaybackStatusUpdate={handleVideoProgress}
            />
        );
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()}>
                            <Text style={styles.backButton}>← Back</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Video Player */}
                    <View style={styles.videoContainer}>
                        {renderVideoPlayer()}
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressSection}>
                        <View style={styles.progressRow}>
                            <Text style={styles.progressLabel}>Progress</Text>
                            <Text style={styles.progressPercent}>{progress}%</Text>
                        </View>
                        <View style={styles.progressBar}>
                            <View style={[styles.progressFill, { width: `${progress}%` }]} />
                        </View>
                    </View>

                    {/* Lesson Info */}
                    <View style={styles.lessonInfo}>
                        <Text style={styles.lessonTitle}>{lesson.title}</Text>
                        {lesson.duration_minutes && (
                            <Text style={styles.lessonDuration}>⏱️ {lesson.duration_minutes} minutes</Text>
                        )}

                        {lesson.description && (
                            <Text style={styles.lessonDescription}>{lesson.description}</Text>
                        )}
                    </View>

                    {/* Actions */}
                    <View style={styles.actions}>
                        {progress < 100 && (
                            <Button
                                title="Mark as Complete"
                                onPress={markComplete}
                                fullWidth
                            />
                        )}

                        {lesson.has_homework && (
                            <TouchableOpacity
                                style={styles.homeworkButton}
                                onPress={() => navigation.navigate('Homework', { lessonId: lesson.id })}
                            >
                                <Text style={styles.homeworkButtonText}>📝 Submit Homework</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { paddingBottom: 100 },
    header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    backButton: { fontSize: 16, color: colors.textSecondary },
    videoContainer: {
        width: width,
        height: width * 0.5625, // 16:9 ratio
        backgroundColor: '#000',
    },
    video: { flex: 1 },
    videoPlaceholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface,
    },
    videoPlaceholderEmoji: { fontSize: 48, marginBottom: spacing.md },
    videoPlaceholderText: { fontSize: 14, color: colors.textMuted },
    progressSection: { padding: spacing.lg },
    progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
    progressLabel: { fontSize: 14, color: colors.textSecondary },
    progressPercent: { fontSize: 14, fontWeight: '600', color: colors.primary },
    progressBar: {
        height: 8,
        backgroundColor: colors.surface,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: colors.primary,
        borderRadius: 4,
    },
    lessonInfo: { paddingHorizontal: spacing.lg },
    lessonTitle: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
    lessonDuration: { fontSize: 14, color: colors.textMuted, marginBottom: spacing.md },
    lessonDescription: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
    actions: { padding: spacing.lg, gap: spacing.md },
    homeworkButton: {
        backgroundColor: 'rgba(139,92,246,0.1)',
        borderRadius: 12,
        padding: spacing.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(139,92,246,0.3)',
    },
    homeworkButtonText: { fontSize: 16, fontWeight: '600', color: colors.primary },
});

export default LessonScreen;
