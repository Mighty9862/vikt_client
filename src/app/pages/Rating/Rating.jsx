import styles from "./Rating.module.scss";
import Table from "../../components/table/Table";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";

function Rating() {
  document.title = "Викторина | Рейтинг";
  const navigate = useNavigate();
  const wsRef = useRef(null);
  const [isComponentMounted, setIsComponentMounted] = useState(true);
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    let isInitialConnection = true;

    const connectWebSocket = () => {
      // Если соединение уже существует, не создаем новое
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      
      // Закрываем предыдущее соединение если оно есть
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      wsRef.current = new WebSocket("ws://80.253.19.93:8000/api/v2/websocket/ws/spectator");

      wsRef.current.onmessage = (event) => {
        if (!isComponentMounted) return;

        try {
          const data = JSON.parse(event.data);
          if (data.type === "question") {
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

      wsRef.current.onclose = () => {
        // Переподключаемся только если компонент все еще смонтирован
        // и это не первое подключение
        if (isComponentMounted && !isInitialConnection) {
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 2000);
        }
      };

      isInitialConnection = false;
    };

    setIsComponentMounted(true);
    connectWebSocket();

    return () => {
      setIsComponentMounted(false);
      
      // Очищаем таймер переподключения
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Закрываем соединение
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
