const { performance } = require('perf_hooks');

const NUM_COURSES = 50;

// Mock database
const dbCourses = Array.from({ length: NUM_COURSES }, (_, i) => ({ id: `course_${i}`, title: `Course ${i}` }));
const dbLessons = dbCourses.flatMap(c =>
    Array.from({ length: 10 }, (_, i) => ({
        id: `lesson_${c.id}_${i}`,
        course_id: c.id,
        duration_minutes: 5,
        video_url: null
    }))
);

let queryCount = 0;

const mockSupabase = {
    from: (table) => ({
        select: (fields, options) => ({
            eq: async (field, value) => {
                queryCount++;
                // Simulate network latency
                await new Promise(r => setTimeout(r, 5));
                if (table === 'lessons' && field === 'course_id') {
                    const data = dbLessons.filter(l => l.course_id === value);
                    return { data, count: data.length, error: null };
                }
                return { data: [], count: 0, error: null };
            },
            in: async (field, values) => {
                queryCount++;
                // Simulate network latency (slightly longer for a larger payload but just 1 query)
                await new Promise(r => setTimeout(r, 10));
                if (table === 'lessons' && field === 'course_id') {
                    const data = dbLessons.filter(l => values.includes(l.course_id));
                    return { data, error: null };
                }
                return { data: [], error: null };
            }
        })
    })
};

const isStreamingUrl = () => true;
const probeVideoDuration = async () => null;
const getRandomRating = () => "4.5";
const formatTotalDuration = () => "1h";

async function nPlusOneApproach() {
    queryCount = 0;
    const start = performance.now();

    const data = dbCourses;

    const enrichedCourses = await Promise.all(
        (data || []).map(async (course) => {
            const { data: lessonData, count } = await mockSupabase
                .from('lessons')
                .select('id, duration_minutes, video_url', { count: 'exact' })
                .eq('course_id', course.id);

            let totalSeconds = 0;
            await Promise.all(
                (lessonData || []).map(async (lesson) => {
                    totalSeconds += (lesson.duration_minutes || 0);
                })
            );

            return {
                ...course,
                lesson_count: count || 0,
                duration: totalSeconds
            };
        })
    );

    const end = performance.now();
    console.log(`N+1 Approach: ${end - start} ms, Queries: ${queryCount}`);
    return end - start;
}

async function optimizedApproach() {
    queryCount = 0;
    const start = performance.now();

    const data = dbCourses;

    const courseIds = (data || []).map(c => c.id);
    let allLessons = [];
    if (courseIds.length > 0) {
        const { data: lessonData } = await mockSupabase
            .from('lessons')
            .select('id, course_id, duration_minutes, video_url')
            .in('course_id', courseIds);
        allLessons = lessonData || [];
    }

    const lessonsByCourse = allLessons.reduce((acc, lesson) => {
        if (!acc[lesson.course_id]) {
            acc[lesson.course_id] = [];
        }
        acc[lesson.course_id].push(lesson);
        return acc;
    }, {});

    const enrichedCourses = await Promise.all(
        (data || []).map(async (course) => {
            const lessonData = lessonsByCourse[course.id] || [];
            const count = lessonData.length;

            let totalSeconds = 0;
            await Promise.all(
                (lessonData || []).map(async (lesson) => {
                    totalSeconds += (lesson.duration_minutes || 0);
                })
            );

            return {
                ...course,
                lesson_count: count || 0,
                duration: totalSeconds
            };
        })
    );

    const end = performance.now();
    console.log(`Optimized Approach: ${end - start} ms, Queries: ${queryCount}`);
    return end - start;
}

async function run() {
    await nPlusOneApproach();
    await optimizedApproach();
}

run();
