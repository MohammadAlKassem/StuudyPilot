function StatCard({ caption, icon: Icon, label, tone = 'blue', value }) {
  return (
    <div className="stat-card">
      <div className={`stat-card__icon stat-card__icon--${tone}`}>
        {Icon && <Icon size={22} aria-hidden="true" />}
      </div>
      <div>
        <p className="stat-card__label">{label}</p>
        <p className="stat-card__value">{value}</p>
        {caption && <p className="stat-card__caption">{caption}</p>}
      </div>
    </div>
  );
}

export default StatCard;
