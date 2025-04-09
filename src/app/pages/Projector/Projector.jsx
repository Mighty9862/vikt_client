import styles from "./Projector.module.scss";
import AnswerTimer from "../../components/answerTimer/AnswerTimer";
import QuestionWheel from "../QuestionWheel/QuestionWheel";
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import TeamsAnswers from "../../components/teamsAnswers/TeamsAnswers";
import { getWebSocketUrl } from "../../../api/websocketConfig";

function Projector() {
  const [seconds, setSeconds] = useState(0);
  const [newSeconds, setNewSeconds] = useState(null);
  const navigate = useNavigate();
  const [question, setQuestion] = useState(() => localStorage.getItem("question") || "");
  const [chapter, setChapter] = useState(() => localStorage.getItem("chapter") || "");
  const [timer, setTimer] = useState(() => localStorage.getItem("timer") === "true" || null);
  const [showAnswer, setShowAnswer] = useState(() => localStorage.getItem("showAnswer") === "true" || null);
  const [questionImage, setQuestionImage] = useState(() => localStorage.getItem("questionImage") || "");
  const [answerImage, setAnswerImage] = useState(() => localStorage.getItem("answerImage") || "");
  const [showWheel, setShowWheel] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState(null);
  const wsRef = useRef(null);
  const prevQuestionRef = useRef(() => localStorage.getItem("prevQuestion") || "");
  const reconnectTimeoutRef = useRef(null);
  const isConnecting = useRef(false);
  const mainAudioRef = useRef(null);
  const shortAudioRef = useRef(null);
  const finalAudioRef = useRef(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [correctAnswer, setCorrectAnswer] = useState(() => localStorage.getItem("correctAnswer") || "");

  // Очищаем флаг shouldShowWheel при загрузке страницы
  useEffect(() => {
    localStorage.removeItem("shouldShowWheel");
  }, []);

  // Сохраняем данные в localStorage при их изменении
  useEffect(() => {
    if (question) localStorage.setItem("question", question);
    if (chapter) localStorage.setItem("chapter", chapter);
    if (timer !== null) localStorage.setItem("timer", timer.toString());
    if (showAnswer !== null) localStorage.setItem("showAnswer", showAnswer.toString());
    if (questionImage) localStorage.setItem("questionImage", questionImage);
    if (answerImage) localStorage.setItem("answerImage", answerImage);
    if (correctAnswer) localStorage.setItem("correctAnswer", correctAnswer);
    if (prevQuestionRef.current) localStorage.setItem("prevQuestion", prevQuestionRef.current);
  }, [question, chapter, timer, showAnswer, questionImage, answerImage, correctAnswer]);

  // Инициализация аудио элементов
  useEffect(() => {
    mainAudioRef.current = new Audio("/timer.mp3"); // Основная музыка таймера (40 секунд)
    mainAudioRef.current.volume = 0.5;
    
    shortAudioRef.current = new Audio("/timer_10.mp3"); // Музыка для таймера на 10 секунд
    shortAudioRef.current.volume = 0.5;

    return () => {
      if (mainAudioRef.current) {
        mainAudioRef.current.pause();
        mainAudioRef.current = null;
      }
      if (shortAudioRef.current) {
        shortAudioRef.current.pause();
        shortAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!timer && mainAudioRef.current) {
      mainAudioRef.current.pause();
      mainAudioRef.current.currentTime = 0;
    }
    if (!timer && shortAudioRef.current) {
      shortAudioRef.current.pause();
      shortAudioRef.current.currentTime = 0;
    }
  }, [timer, question]);

  // Функция для управления аудио таймера
  const handleTimerAudio = (second) => {
    if (!audioEnabled) {
      try {
        mainAudioRef.current.play().then(() => {
          mainAudioRef.current.pause();
          setAudioEnabled(true);
        });
      } catch (error) {
        console.error("Error enabling audio:", error);
      }
      return;
    }

    const initialDuration = localStorage.getItem("initialTimerDuration");
    if (!initialDuration) return;

    const duration = parseInt(initialDuration, 10);
    
    // Запускаем звук только если это начало таймера (40 или 10 секунд)
    if (second === 40 || second === 10) {
      // Проверяем, что это действительно начало таймера, а не просто совпадение с числом 10
      if (second === duration) {
        if (duration === 40) {
          mainAudioRef.current.currentTime = 0;
          mainAudioRef.current.play();
        } else if (duration === 10) {
          shortAudioRef.current.currentTime = 0;
          shortAudioRef.current.play();
        }
      }
    }
  };

  const connectWebSocket = useCallback(() => {
    // Если уже идет подключение, не создаем новое
    if (isConnecting.current) {
      return;
    }

    // Очищаем предыдущий таймаут
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    try {
      isConnecting.current = true;
      const websocket = new WebSocket(getWebSocketUrl("/ws/spectator"));

      websocket.onopen = () => {
        isConnecting.current = false;
        wsRef.current = websocket;
      };

      websocket.onclose = (event) => {
        wsRef.current = null;
        isConnecting.current = false;

        // Пытаемся переподключиться через 2 секунды
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 2000);
      };

      websocket.onerror = (error) => {
        console.error("Projector WebSocket error:", error);
        isConnecting.current = false;
      };

      websocket.onmessage = (event) => {
        try {
          if (event.data === "clear_storage") {
            localStorage.clear();
            location.reload();
            return;
          }

          const data = JSON.parse(event.data);
          console.log("Получено WebSocket сообщение:", data);
          if (data.type === "rating") {
            navigate("/rating", { state: { data: data } });
          } else if (data.type === "question") {
            if (data.content !== prevQuestionRef.current) {
              // Проверяем, нужно ли показывать колесо
              const shouldShowWheel = localStorage.getItem("shouldShowWheel") === "true";
              
              if (shouldShowWheel) {
                setShowWheel(true);
                // Сбрасываем флаг после использования
                localStorage.removeItem("shouldShowWheel");
              }
              
              prevQuestionRef.current = data.content; // Сохраняем текущий вопрос
              setPendingQuestion(data);
            } else {
              // Если условия не выполняются, просто обновляем данные без анимации
              setQuestion(data.content);
              setChapter(data.section);
              setCorrectAnswer(data.answer);
              if (data.timer !== undefined) {
                setTimer(data.timer);
              }
              if (data.seconds !== undefined) {
                setNewSeconds(data.seconds);
              }
              if (data.show_answer !== undefined) {
              }
              setShowAnswer(data.show_answer);
            }
          } else if (data.type === "screen") {
            navigate("/screen");
          } else if (data.type === "timer") {
            // Обработка сообщения о запуске таймера
            console.log("Получено сообщение о таймере:", data);
            
            // Получаем длительность таймера из localStorage
            const timerDuration = localStorage.getItem("answerTimerSeconds");
            console.log("Длительность таймера из localStorage:", timerDuration);
            
            if (timerDuration) {
              const duration = parseInt(timerDuration, 10);
              setNewSeconds(duration);
            } else {
              setNewSeconds(40);
            }
            
            setTimer(true);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };
    } catch (error) {
      console.error("Error creating WebSocket connection:", error);
      isConnecting.current = false;

      // Пытаемся переподключиться через 2 секунды
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, 2000);
    }
  }, [navigate]);

  useEffect(() => {
    connectWebSocket();

    // Очистка при размонтировании
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  const handleTimeUp = () => {};

  const extractTime = (second) => {
    setSeconds(second);
    handleTimerAudio(second);
  };

  console.log(correctAnswer);

  return (
    <div className={styles.window}>
      <title>Викторина | Проектор</title>
      <QuestionWheel
        isVisible={showWheel}
        onAnimationComplete={() => {
          if (pendingQuestion) {
            setQuestion(pendingQuestion.content);
            setChapter(pendingQuestion.section);
            setCorrectAnswer(pendingQuestion.answer);
            
            // Получаем длительность таймера из localStorage
            const timerDuration = localStorage.getItem("answerTimerSeconds");
            const duration = timerDuration ? parseInt(timerDuration, 10) : 40;
            
            setNewSeconds(duration);
            localStorage.setItem("answerTimerSeconds", duration.toString());
            setTimer(pendingQuestion.timer);
            setShowAnswer(pendingQuestion.show_answer);
            setQuestionImage(
              pendingQuestion.question_image
                ? `http://80.253.19.93:8000/static/images/${pendingQuestion.question_image}`
                : ""
            );
            setAnswerImage(
              pendingQuestion.answer_image
                ? `http://80.253.19.93:8000/static/images/${pendingQuestion.answer_image}`
                : ""
            );
            setPendingQuestion(null);
          }
          setShowWheel(false);
        }}
        animationSpeed={4}
      />
      {!showWheel && (
        <>
          <div className={styles.header}>
            <h1 className={styles.chapter}>{chapter || "Ожидайте раздел"}</h1>
            <div className={styles.timer}>
              {timer && (
                <AnswerTimer
                  time={extractTime}
                  duration={newSeconds || 40}
                  onTimeUp={handleTimeUp}
                  question={question}
                />
              )}
            </div>
            {!showAnswer && (
              <p className={styles.question}>{question || "Ожидайте вопрос"}</p>
            )}
          </div>
          {showAnswer && (
            <div className={styles.correctAnswer}>
              <div className={styles.answerImageContainer}>
                <img
                  src={answerImage}
                  className={styles.image}
                  alt="Изображение к вопросу"
                  onError={(e) => {
                    console.error("Failed to load image:", answerImage);
                    e.target.style.display = "none";
                  }}
                />
              </div>
              <div className={styles.correctAnswer__header}>
                <div className={styles.answer}>{correctAnswer}</div>
                <TeamsAnswers className={styles.answers} question={question} />
              </div>
            </div>
          )}
          <div className={styles.container}>
            {!showAnswer && questionImage ? (
              <img
                src={questionImage}
                className={styles.image}
                alt="Изображение к вопросу"
                onError={(e) => {
                  console.error("Failed to load image:", questionImage);
                  e.target.style.display = "none";
                }}
              />
            ) : (
              <div className={styles.placeholder}></div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default Projector;
