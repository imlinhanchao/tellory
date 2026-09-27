import { createApp } from "vue";
import MessageBox from "./src/MessageBox.vue";

export interface MsgBoxOptions {
  title?: string;
  message?: string | any;
  showCancel?: boolean;
  confirmText?: string;
  cancelText?: string;
  showInput?: boolean;
  inputPlaceholder?: string;
  inputValue?: string;
  inputType?: string;
}

function mountBox<T = boolean>(options: MsgBoxOptions): Promise<T | false> {
  const container = document.createElement("div");
  document.body.appendChild(container);

  return new Promise((resolve) => {
    let settled = false;
    let closed = false;
    let app: ReturnType<typeof createApp> | null = null;

    function close() {
      if (closed) return;
      closed = true;
      try {
        app?.unmount();
      } catch (e) {
        // ignore
      }
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }

    function safeResolve(val: T | false) {
      if (settled) return;
      settled = true;
      resolve(val);
      close();
    }

    app = createApp(MessageBox, {
      ...options,
      visible: true,
      onConfirm: (val: any) => {
        // 接收组件 emit 出来的值
        safeResolve(val);
      },
      onCancel: () => {
        safeResolve(false);
      },
      onClose: () => {
        safeResolve(false);
      },
    });

    app.mount(container);
  });
}

export function confirm(
  message: string,
  title = "确认",
  options: Partial<MsgBoxOptions> = {},
) {
  return mountBox<boolean>({ title, message, showCancel: true, ...options });
}

export function alert(
  message: string,
  title = "提示",
  options: Partial<MsgBoxOptions> = {},
) {
  return mountBox<boolean>({
    title,
    message,
    showCancel: false,
    confirmText: "知道了",
    ...options,
  });
}

export function prompt(
  message: string,
  title = "请输入",
  options: Partial<MsgBoxOptions> = {},
) {
  return mountBox<string | false>({
    title,
    message,
    showCancel: true,
    showInput: true,
    ...options,
  });
}

export default {
  confirm,
  alert,
  prompt,
};
