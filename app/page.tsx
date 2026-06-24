const endpoints = [
  {
    method: 'POST',
    path: '/api/oauth/token',
    description: 'OAuth2 Client Credentials (M2M) — issue access token',
  },
  {
    method: 'GET',
    path: '/api/getheadertoken',
    description: 'Protected resource — return sample user info (userId = token + LamPi)',
  },
  {
    method: 'GET/POST',
    path: '/api/orderinfo',
    description: 'Return seeded random order info by userId or email',
  },
  {
    method: 'GET',
    path: '/api/order',
    description: 'Return a single order by orderId query param',
  },
];

export default function HomePage() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 720 }}>
      <h1>Sample API</h1>
      <p>Public testing endpoints for OAuth2 Machine-to-Machine (Client Credentials).</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1.5rem' }}>
        <thead>
          <tr>
            <th align="left">Method</th>
            <th align="left">Path</th>
            <th align="left">Description</th>
          </tr>
        </thead>
        <tbody>
          {endpoints.map((endpoint) => (
            <tr key={`${endpoint.method}-${endpoint.path}`}>
              <td>{endpoint.method}</td>
              <td>
                <code>{endpoint.path}</code>
              </td>
              <td>{endpoint.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <section style={{ marginTop: '2rem' }}>
        <h2>M2M test credentials (default)</h2>
        <ul>
          <li>
            <code>client_id</code>: test-m2m-client
          </li>
          <li>
            <code>client_secret</code>: test-m2m-secret
          </li>
        </ul>
      </section>
    </main>
  );
}
