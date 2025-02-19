import styles from "./Rating.module.scss";
import Table from "../../components/table/Table";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";

function Rating() {
  document.title = "Викторина | Рейтинг";
  const navigate = useNavigate();
  const wsRef = useRef(null);
  const [isComponentMounted, setIsComponentMounted] = useState(true);

  useEffect(() => {
    // Устанавливаем флаг монтирования
    setIsComponentMounted(true);

    // Создаем WebSocket соединение
    wsRef.current = new WebSocket("ws://80.253.19.93:8000/api/v2/websocket/ws/spectator");

    wsRef.current.onmessage = (event) => {
      if (!isComponentMounted) return;

      try {
        const data = JSON.parse(event.data);
        if (data.type === "question") {
          // Закрываем текущее соединение перед навигацией
          if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
          }
          navigate("/projector", { state: { data: data } });
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    // Очистка при размонтировании
    return () => {
      setIsComponentMounted(false);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [navigate]);

  return (
    <div className={styles.window}>
      <h1 className={styles.header}>Рейтинг участников</h1>
      <p className={styles.caption}>Рейтинг по количеству набранных баллов</p>
      <div>
        <Table />
      </div>
    </div>
  );
}

export default Rating;
