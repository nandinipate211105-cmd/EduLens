exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'GEMINI_API_KEY not set in Netlify environment variables.' }),
    };
  }

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);

    const body = JSON.parse(event.body || '{}');
    const task = body.task;

    const model = genAI.getGenerativeModel({ model: body.model || 'gemini-1.5-flash' });

    const inline = body.base64 && body.mimeType
      ? [{ inlineData: { data: body.base64, mimeType: body.mimeType } }]
      : [];

    if (task === 'extractQuestions') {
      const subject = body.subject || 'Math';
      const prompt =
        `Extract ALL questions from this ${subject} question paper.\n` +
        `Return ONLY valid JSON array of strings like ["Q1: ...","Q2: ..."]. No markdown.`;

      const result = await model.generateContent([
        ...inline,
        { text: prompt },
      ]);

      const text = result.response.text() || '[]';
      const match = text.match(/\[[\s\S]*\]/);
      const questions = match ? JSON.parse(match[0]) : [];

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ questions }),
      };
    }

    if (task === 'analyzeAnswerSheet') {
      const studentName = body.studentName || 'Student';
      const subject = body.subject || 'Math';
      const questions = Array.isArray(body.questions) ? body.questions.slice(0, 25) : [];

      const prompt =
        `You are an expert teacher AI. Analyze this student's answer sheet.\n\n` +
        `Student: ${studentName}\nSubject: ${subject}\n\n` +
        `Questions (for context):\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n` +
        `Return ONLY valid JSON (no markdown, no extra text) in this exact shape:\n` +
        `{"score":<0-100>,"maxScore":100,"percentage":<0-100>,` +
        `"weakTopics":[{"topic":"<topic>","reason":"<reason>","severity":"high|medium|low"}],` +
        `"strongTopics":["<topic>"],"feedback":"<2-3 sentences>","studyPlan":"<3-step plan>"}`;

      const result = await model.generateContent([
        ...inline,
        { text: prompt },
      ]);

      const text = result.response.text() || '{}';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Gemini returned unexpected format.');
      const json = JSON.parse(match[0]);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(json),
      };
    }

    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Unknown task. Use task=extractQuestions or task=analyzeAnswerSheet.' }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message || String(err) }),
    };
  }
};

