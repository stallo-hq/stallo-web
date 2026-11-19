interface Props {
  title: string
  owner: string
  todo: string[]
}

/** Temporary page shell. Replace with the real feature when you pick it up. */
export function PagePlaceholder({ title, owner, todo }: Props) {
  return (
    <section>
      <h1>{title}</h1>
      <p className="muted">Owner: {owner}</p>
      <ul>
        {todo.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </section>
  )
}
