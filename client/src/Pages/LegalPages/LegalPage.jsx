import styles from './LegalPage.module.scss';

function LegalPage({ title, updatedAt, intro, sections }) {
    return (
        <main className={styles.page}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <p className={styles.eyebrow}>NESTFINDER</p>
                    <h1>{title}</h1>
                    <p>{intro}</p>
                    {updatedAt && <span>Cập nhật: {updatedAt}</span>}
                </div>

                <div className={styles.content}>
                    {sections.map((section, index) => (
                        <section key={section.title}>
                            <h2>
                                {index + 1}. {section.title}
                            </h2>
                            {section.description && <p>{section.description}</p>}
                            {section.items?.length > 0 && (
                                <ul>
                                    {section.items.map((item) => (
                                        <li key={item}>{item}</li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    ))}
                </div>
            </div>
        </main>
    );
}

export default LegalPage;
