import BadgeCard from "./BadgeCard";

const BadgePreview = ({ badge, userInfo, cardRef }) => {
  if (!badge) return null;
  return (
    <div style={{ position: "absolute", top: "-10000px", left: "-10000px" }}>
      <BadgeCard badge={badge} userInfo={userInfo} cardRef={cardRef} />
    </div>
  );
};

export default BadgePreview;
