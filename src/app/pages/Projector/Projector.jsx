import styles from "./Projector.module.scss";
import AnswerTimer from "../../components/answerTimer/AnswerTimer";
import QuestionWheel from "../QuestionWheel/QuestionWheel";
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "react-query";
import TeamsAnswers from "../../components/teamsAnswers/TeamsAnswers";
function Projector() {
  document.title = "Викторина | Проектор";

  const [seconds, setSeconds] = useState(0);
  const [newSeconds, setNewSeconds] = useState(null);
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const [chapter, setChapter] = useState("");
  const [timer, setTimer] = useState(null);
  const [showAnswer, setShowAnswer] = useState(null);
  const [questionImage, setQuestionImage] = useState("");
  const [showWheel, setShowWheel] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isConnecting = useRef(false);
  const mainAudioRef = useRef(null);
  const finalAudioRef = useRef(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [questionId, setQuestionId] = useState(null);

  // Добавляем флаг для отслеживания монтирования компонента
  const [isComponentMounted, setIsComponentMounted] = useState(true);
  
  // Добавляем состояние для отслеживания статуса соединения
  const [wsConnected, setWsConnected] = useState(false);

  // Инициализация аудио элементов
  useEffect(() => {
    mainAudioRef.current = new Audio("/timer.mp3"); // Основная музыка таймера
    finalAudioRef.current = new Audio("/final.mp3"); // Музыка последних секунд

    mainAudioRef.current.volume = 0.5;
    finalAudioRef.current.volume = 0.5;

    return () => {
      if (mainAudioRef.current) {
        mainAudioRef.current.pause();
        mainAudioRef.current = null;
      }
      if (finalAudioRef.current) {
        finalAudioRef.current.pause();
        finalAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!timer) {
      // Если таймер выключен, останавливаем все аудио
      if (mainAudioRef.current) {
        mainAudioRef.current.pause();
        mainAudioRef.current.currentTime = 0;
      }
      if (finalAudioRef.current) {
        finalAudioRef.current.pause();
        finalAudioRef.current.currentTime = 0;
      }
    }
  }, [timer, question]);

  // Функция для управления аудио таймера
  const handleTimerAudio = useCallback((second) => {
    if (!audioEnabled) {
      // Пробуем включить аудио при первом тике таймера
      try {
        // Используем одну попытку воспроизведения вместо двух
        mainAudioRef.current.play()
          .then(() => {
            setAudioEnabled(true);
          })
          .catch((error) => {
            console.error("Error enabling audio:", error);
          });
      } catch (error) {
        console.error("Error enabling audio:", error);
      }
      return;
    }

    if (second <= 2) {
      // Последние 2 секунды
      if (mainAudioRef.current) {
        mainAudioRef.current.pause();
        mainAudioRef.current.currentTime = 0;
      }
      if (finalAudioRef.current) {
        finalAudioRef.current.currentTime = 0;
        finalAudioRef.current.play().catch(error => {
          console.error("Error playing final audio:", error);
        });
      }
    } else if (second === 40) {
      // Начало таймера
      if (finalAudioRef.current) {
        finalAudioRef.current.pause();
        finalAudioRef.current.currentTime = 0;
      }
      if (mainAudioRef.current) {
        mainAudioRef.current.currentTime = 0;
        mainAudioRef.current.play().catch(error => {
          console.error("Error playing main audio:", error);
        });
      }
    }
  }, [audioEnabled]);

  const extractTime = useCallback((second) => {
    setSeconds(second);
    handleTimerAudio(second);
  }, [handleTimerAudio]);

  const connectWebSocket = useCallback(() => {
    if (!isComponentMounted || isConnecting.current) {
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    try {
      isConnecting.current = true;
      const websocket = new WebSocket(
        "ws://80.253.19.93:8000/api/v2/websocket/ws/spectator"
      );

      websocket.onopen = () => {
        console.log("WebSocket соединение установлено");
        setWsConnected(true);
        isConnecting.current = false;
        wsRef.current = websocket;
      };

      websocket.onclose = () => {
        console.log("WebSocket соединение закрыто");
        wsRef.current = null;
        setWsConnected(false);
        isConnecting.current = false;

        if (isComponentMounted) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, 2000);
        }
      };

      websocket.onerror = (error) => {
        console.error("Projector WebSocket error:", error);
        isConnecting.current = false;
      };

      let lastMessage = null;
      let lastMessageTime = 0;
      const MESSAGE_DEBOUNCE = 100; // 100ms дебаунс

      websocket.onmessage = (event) => {
        try {
          // Проверяем, что данные не пустые
          if (!event.data) {
            console.warn("Получено пустое WebSocket сообщение");
            return;
          }

          if (event.data === "clear_storage") {
            localStorage.clear();
            location.reload();
            return;
          }

          // Проверяем, что данные являются валидным JSON
          let data;
          try {
            data = JSON.parse(event.data);
          } catch (parseError) {
            console.warn("Получено невалидное JSON сообщение:", event.data);
            return;
          }

          const now = Date.now();
          
          // Проверяем, не является ли это дублирующим сообщением
          if (lastMessage && 
              JSON.stringify(lastMessage) === JSON.stringify(data) && 
              now - lastMessageTime < MESSAGE_DEBOUNCE) {
            return;
          }

          lastMessage = data;
          lastMessageTime = now;
          
          if (data.type === "rating") {
            // Останавливаем аудио и очищаем ресурсы
            if (mainAudioRef.current) {
              mainAudioRef.current.pause();
              mainAudioRef.current.currentTime = 0;
            }
            if (finalAudioRef.current) {
              finalAudioRef.current.pause();
              finalAudioRef.current.currentTime = 0;
            }

            // Закрываем WebSocket соединение
            if (wsRef.current) {
              wsRef.current.close();
              wsRef.current = null;
            }
            
            // Очищаем таймер переподключения
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
              reconnectTimeoutRef.current = null;
            }
            
            // Важно: устанавливаем флаг монтирования в false перед навигацией
            setIsComponentMounted(false);
            
            // Выполняем навигацию
            navigate("/rating", { 
              state: { data: data },
              replace: true 
            });
            
            return;
          } else if (data.type === "question") {
            // Сбрасываем все состояния при получении нового вопроса
            setShowAnswer(data.show_answer || false);
            setTimer(data.timer || false);
            setQuestion(data.content || "");
            setChapter(data.section || "");
            setCorrectAnswer(data.answer || "");
            setQuestionImage(data.question_image ? 
              `http://80.253.19.93:8000/static/images/${data.question_image}` : "");
            
            // Если таймер выключен, останавливаем аудио
            if (!data.timer) {
              if (mainAudioRef.current) {
                mainAudioRef.current.pause();
                mainAudioRef.current.currentTime = 0;
              }
              if (finalAudioRef.current) {
                finalAudioRef.current.pause();
                finalAudioRef.current.currentTime = 0;
              }
            }

            // Если это новый вопрос (с колесом)
            if (data.timer === false && data.answer !== null) {
              setPendingQuestion(data);
              setShowWheel(true);
            }
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };
    } catch (error) {
      console.error("Error creating WebSocket connection:", error);
      isConnecting.current = false;
      
      if (isComponentMounted) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 2000);
      }
    }
  }, [isComponentMounted, navigate]);

  useEffect(() => {
    setIsComponentMounted(true);
    
    // Задержка перед первым подключением
    const initialConnectionTimer = setTimeout(() => {
      connectWebSocket();
    }, 1000);

    return () => {
      setIsComponentMounted(false);
      clearTimeout(initialConnectionTimer);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connectWebSocket]);

  const handleTimeUp = () => {};

  console.log(correctAnswer);

  // Изменяем эффект очистки при размонтировании
  useEffect(() => {
    return () => {
      // Устанавливаем флаг размонтирования
      setIsComponentMounted(false);
      
      // Очищаем аудио ресурсы
      if (mainAudioRef.current) {
        mainAudioRef.current.pause();
        mainAudioRef.current = null;
      }
      if (finalAudioRef.current) {
        finalAudioRef.current.pause();
        finalAudioRef.current = null;
      }
      
      // Закрываем WebSocket если он открыт
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      
      // Очищаем таймер переподключения
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, []);

  // В компоненте добавим эффект для сброса состояния при монтировании
  useEffect(() => {
    // Сброс всех состояний при монтировании компонента
    setShowAnswer(false);
    setTimer(false);
    setQuestion("");
    setChapter("");
    setCorrectAnswer("");
    setQuestionImage("");
    setShowWheel(false);
    setPendingQuestion(null);
    setSeconds(0);
    setNewSeconds(null);
    setAudioEnabled(false);

    if (mainAudioRef.current) {
      mainAudioRef.current.pause();
      mainAudioRef.current.currentTime = 0;
    }
    if (finalAudioRef.current) {
      finalAudioRef.current.pause();
      finalAudioRef.current.currentTime = 0;
    }
  }, []); // Пустой массив зависимостей означает, что эффект выполнится только при монтировании

  return (
    <div className={styles.window}>
      {!wsConnected && (
        <div className={styles.connectionStatus}>
          Подключение к серверу...
        </div>
      )}
      <QuestionWheel
        isVisible={showWheel}
        onAnimationComplete={() => {
          // После завершения анимации обновляем данные
          if (pendingQuestion) {
            setQuestion(pendingQuestion.content);
            setChapter(pendingQuestion.section);
            setCorrectAnswer(pendingQuestion.answer);
            const timerDuration = 40;
            setNewSeconds(timerDuration);
            localStorage.setItem("answerTimerSeconds", timerDuration);
            setTimer(pendingQuestion.timer);
            setShowAnswer(pendingQuestion.show_answer);
            if (pendingQuestion.question_image) {
              const imagePath = `http://80.253.19.93:8000/static/images/${pendingQuestion.question_image}`;
              setQuestionImage(imagePath);
            } else {
              setQuestionImage("");
            }
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
                  duration={40}
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
              <div className={styles.answer}>{correctAnswer}</div>
              <TeamsAnswers question={question} />
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
