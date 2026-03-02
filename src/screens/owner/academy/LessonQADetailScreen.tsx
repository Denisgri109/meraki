/**
 * LessonQADetailScreen — Owner's full-screen Q&A view for a specific lesson.
 * 
 * Wraps the shared LessonQAChat component in a proper screen layout
 * so the owner can respond to student questions from the academy tab.
 */
import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MerakiText } from '../../../components/ui';
import { LessonQAChat } from '../../../components/academy/LessonQAChat';
import { colors, spacing } from '../../../theme';

export function LessonQADetailScreen() {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const { lesson, courseId, instructorId, instructorName } = route.params || {};

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <MerakiText variant="bodyBold" numberOfLines={1} style={styles.headerTitle}>
                            {lesson?.title || 'Lesson Q&A'}
                        </MerakiText>
                        {instructorName && (
                            <MerakiText variant="caption" color={colors.textMuted} numberOfLines={1}>
                                Instructor: {instructorName}
                            </MerakiText>
                        )}
                    </View>
                    <View style={{ width: 24 }} />
                </View>

                <LessonQAChat
                    lessonId={lesson?.id}
                    courseId={courseId}
                    instructorId={instructorId}
                    isInstructor={true}
                />
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    safeArea: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: spacing.md,
    },
    headerCenter: { flex: 1 },
    headerTitle: { color: colors.text },
});

export default LessonQADetailScreen;
