import { getByPath } from "../store/action";
export const directSave = (dispatch, type, payload, keyName, keyTarget) => {
  dispatch({ type, payload, keyName, keyTarget });
};
export const fetchData = (
  dispatch,
  path,
  data,
  name,
  method,
  keyName,
  toast,
  extra,
) => {
  dispatch(getByPath(path, data, name, method, keyName, toast, extra));
};

export const toastBoth = {
  // top-left, top-center, top-right, bottom-left, bottom-center, bottom-right
  success: {
    type: "success",
    title: "Success",
    description: "Successfully Data Added",
    position: "top-center",
  },
  error: {
    type: "error",
    title: "Error",
    description: "apiMsg",
    position: "top-center",
  },
};
export const getToast = (type, title, description, position) => {
  const toast = JSON.parse(JSON.stringify(toastBoth));
  if (!type) return toast;
  let finalToast = {
    [type]: toast[type],
  };
  if (title) {
    finalToast[type].title = title;
  }
  if (description) {
    finalToast[type].description = description;
  }
  if (position) {
    finalToast[type].position = position;
  }
  return finalToast;
};

export const calculateFontSize = (text, maxWidth, maxFontSize) => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  let fontSize = maxFontSize;
  ctx.font = `${fontSize}px sans-serif`;
  while (ctx.measureText(text).width > maxWidth && fontSize > 8) {
    fontSize -= 1;
    ctx.font = `${fontSize}px sans-serif`;
  }
  return fontSize;
};
