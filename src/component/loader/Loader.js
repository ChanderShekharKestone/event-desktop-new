import styles from "./Loader.module.css";
const CustomLoader = () => {
  return (
    <div className={styles.wrapper}>
      <div className={styles.loader}></div>
    </div>
  );
};

export default CustomLoader;
