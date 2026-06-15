import { useState, useRef, useEffect } from "react";
import styles from "./Terms.module.scss";

export default function Terms() {
  const [accepted, setAccepted] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const contentRef = useRef(null);

  // Load trạng thái từ localStorage khi component mount
  useEffect(() => {
    const savedAccepted = localStorage.getItem("termsAccepted");
    if (savedAccepted === "true") {
      setAccepted(true);
      setScrolledToBottom(true); // Giả sử nếu đã accepted thì đã scrolled
    }
  }, []);

  // Lưu trạng thái vào localStorage khi accepted thay đổi
  useEffect(() => {
    if (accepted) {
      localStorage.setItem("termsAccepted", "true");
    }
  }, [accepted]);

  const handleScroll = () => {
    const el = contentRef.current;
    if (!el) return;

    const isBottom =
      el.scrollTop + el.clientHeight >= el.scrollHeight - 5;

    if (isBottom) {
      setScrolledToBottom(true);
    }
  };

  const handleContinue = () => {
    alert("Bạn đã đồng ý điều khoản!");
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>Điều khoản sử dụng</h1>

        {/* Scroll box */}
        <div
          className={styles.scrollBox}
          ref={contentRef}
          onScroll={handleScroll}
        >
          <p>
            Khi truy cập và sử dụng hệ thống, bạn đồng ý tuân thủ các điều khoản dưới đây.
          </p>

          <h2>1. Chấp nhận điều khoản</h2>
          <p>Bạn xác nhận đã đọc, hiểu và đồng ý với toàn bộ nội dung điều khoản.</p>

          <h2>2. Tài khoản người dùng</h2>
          <ul>
            <li>Bạn chịu trách nhiệm bảo mật tài khoản.</li>
            <li>Không chia sẻ thông tin đăng nhập.</li>
            <li>Chúng tôi có quyền khóa tài khoản vi phạm.</li>
          </ul>

          <h2>3. Hành vi bị cấm</h2>
          <ul>
            <li>Sử dụng hệ thống cho mục đích trái phép.</li>
            <li>Tấn công, spam hoặc phá hoại hệ thống.</li>
            <li>Thu thập dữ liệu trái phép.</li>
          </ul>

          <h2>4. Quyền của hệ thống</h2>
          <p>Chúng tôi có quyền thay đổi hoặc ngừng cung cấp dịch vụ bất cứ lúc nào.</p>

          <h2>5. Bảo mật</h2>
          <p>Thông tin cá nhân của bạn sẽ được bảo vệ theo chính sách bảo mật.</p>

          <h2>6. Thay đổi điều khoản</h2>
          <p>Điều khoản có thể được cập nhật.</p>

          <h2>7. Liên hệ</h2>
          <p>Email: nguyenthevan22012004@gmail.com</p>
        </div>

        {/* Thông báo */}
        {!scrolledToBottom && (
          <p className={styles.notice}>
            Vui lòng cuộn xuống cuối để tiếp tục
          </p>
        )}

        {/* Checkbox */}
        <div className={styles.checkboxWrapper}>
          <input
            type="checkbox"
            id="accept"
            checked={accepted}
            onChange={() => setAccepted(!accepted)}
            disabled={!scrolledToBottom}
          />
          <label htmlFor="accept">
            Tôi đồng ý với Điều khoản sử dụng
          </label>
        </div>

        {/* Button */}
        <button
          className={styles.button}
          disabled={!accepted || !scrolledToBottom}
          onClick={handleContinue}
        >
          Tiếp tục
        </button>
      </div>
    </div>
  );
}