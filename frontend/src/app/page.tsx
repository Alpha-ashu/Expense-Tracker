import { useState, useEffect } from 'react';
import supabase from '@/utils/supabase/client';

export default function Page() {
  const [todos, setTodos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function getTodos() {
      try {
        const { data, error } = await supabase.from('todos').select();
        
        if (error) {
          setError(error.message);
          console.error('Error fetching todos:', error);
        } else if (data) {
          setTodos(data);
        }
      } catch (err) {
        setError('Failed to fetch todos');
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    }

    getTodos();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <ul>
      {todos?.map((todo, index) => (
        <li key={todo.id || index}>{JSON.stringify(todo)}</li>
      ))}
    </ul>
  );
}