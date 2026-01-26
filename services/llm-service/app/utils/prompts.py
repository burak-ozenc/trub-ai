"""
Prompt templates for LLM feedback generation.
"""


def get_feedback_prompt(
    technical_analysis: dict,
    exercise_type: str,
    skill_level: str,
    user_question: str = None,
    guidance: str = None
) -> str:
    """
    Generate a comprehensive feedback prompt for the LLM.

    Args:
        technical_analysis: Analysis results from audio service
        exercise_type: Type of exercise (breathing, tone, rhythm, etc.)
        skill_level: User's skill level (beginner, intermediate, advanced)
        user_question: Optional specific question from user
        guidance: Optional practice guidance from user

    Returns:
        Formatted prompt string
    """

    # Extract key metrics
    pitch_stability = technical_analysis.get("pitch_stability", {})
    tone_quality = technical_analysis.get("tone_quality", {})
    breath_metrics = technical_analysis.get("breath_analysis", {})
    rhythm_metrics = technical_analysis.get("rhythm_analysis", {})

    prompt = f"""You are an expert trumpet instructor providing personalized feedback to a {skill_level} student.

EXERCISE FOCUS: {exercise_type.upper()}

TECHNICAL ANALYSIS RESULTS:
"""

    # Add relevant metrics based on exercise type
    if exercise_type == "breathing":
        prompt += f"""
Breath Analysis:
- Breath Control Score: {breath_metrics.get('breath_control_score', 'N/A')}
- Average Breath Length: {breath_metrics.get('average_breath_length', 'N/A')}s
- Breath Consistency: {breath_metrics.get('consistency', 'N/A')}
"""

    elif exercise_type == "tone":
        prompt += f"""
Tone Quality:
- Overall Tone Score: {tone_quality.get('overall_score', 'N/A')}
- Brightness: {tone_quality.get('brightness', 'N/A')}
- Warmth: {tone_quality.get('warmth', 'N/A')}
- Consistency: {tone_quality.get('consistency', 'N/A')}
"""

    elif exercise_type == "rhythm":
        prompt += f"""
Rhythm Analysis:
- Timing Accuracy: {rhythm_metrics.get('timing_accuracy', 'N/A')}
- Tempo Consistency: {rhythm_metrics.get('tempo_consistency', 'N/A')}
- Note Duration Accuracy: {rhythm_metrics.get('note_duration_accuracy', 'N/A')}
"""

    # Add pitch stability (relevant for all exercises)
    prompt += f"""
Pitch Stability:
- Overall Stability: {pitch_stability.get('overall_stability', 'N/A')}
- Average Deviation: {pitch_stability.get('average_deviation', 'N/A')} cents
"""

    # Add user guidance if provided
    if guidance:
        prompt += f"""
STUDENT'S PRACTICE FOCUS:
{guidance}
"""

    # Add user question if provided
    if user_question:
        prompt += f"""
SPECIFIC QUESTION FROM STUDENT:
{user_question}
"""

    prompt += f"""
INSTRUCTIONS:
1. Analyze the technical metrics in the context of a {skill_level} student
2. Provide constructive, encouraging feedback focusing on {exercise_type} technique
3. Highlight specific strengths shown in the metrics
4. Identify 1-2 key areas for improvement
5. Provide 3-5 specific, actionable recommendations
6. Use supportive, motivational language appropriate for a {skill_level} player
7. If a specific question was asked, address it directly

Format your response as:
FEEDBACK: [2-3 paragraphs of comprehensive feedback]

RECOMMENDATIONS:
- [Recommendation 1]
- [Recommendation 2]
- [Recommendation 3]
...
"""

    return prompt


def get_question_prompt(question: str, context: dict = None) -> str:
    """
    Generate a prompt for answering user questions.

    Args:
        question: User's question
        context: Optional context information

    Returns:
        Formatted prompt string
    """

    prompt = f"""You are an expert trumpet instructor answering a student's question.

STUDENT QUESTION:
{question}
"""

    if context:
        prompt += f"""
CONTEXT:
{context}
"""

    prompt += """
INSTRUCTIONS:
1. Provide a clear, accurate answer to the question
2. Use simple, accessible language
3. Include practical examples when relevant
4. Be encouraging and supportive
5. If the question is unclear, make reasonable assumptions and provide helpful information

Your answer:
"""

    return prompt
