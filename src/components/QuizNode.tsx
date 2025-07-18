import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

interface QuizData {
  question: string;
  answers: string[];
  buttonColor: string;
  backgroundColor: string;
  textColor: string;
  buttonTextColor: string;
  affiliateLinks: string[];
  onUpdate?: (data: any) => void;
}

const QuizNode: React.FC<NodeProps<QuizData>> = ({ data, selected }) => {
  return (
    <div className={`quiz-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Top} />
      
      <div className="node-header">
        <span className="node-icon">❓</span>
        <span className="node-title">Interactive Quiz</span>
      </div>
      
      <div className="quiz-content">
        <input 
          type="text" 
          placeholder="Enter your question"
          value={data.question || ''}
          onChange={(e) => data.onUpdate?.({ question: e.target.value })}
          className="quiz-question-input"
        />
        
        <div className="quiz-answers">
          {(data.answers || []).map((answer, index) => (
            <div key={index} className="answer-group">
              <input
                type="text"
                value={answer}
                placeholder={`Answer ${index + 1}`}
                onChange={(e) => {
                  const newAnswers = [...(data.answers || [])];
                  newAnswers[index] = e.target.value;
                  data.onUpdate?.({ answers: newAnswers });
                }}
                className="answer-input"
              />
              <input
                type="url"
                value={data.affiliateLinks?.[index] || ''}
                placeholder="Affiliate link"
                onChange={(e) => {
                  const newLinks = [...(data.affiliateLinks || [])];
                  newLinks[index] = e.target.value;
                  data.onUpdate?.({ affiliateLinks: newLinks });
                }}
                className="affiliate-input"
              />
            </div>
          ))}
        </div>
        
        <div className="color-controls">
          <div className="color-group">
            <label>Button Color:</label>
            <input 
              type="color" 
              value={data.buttonColor || '#007bff'}
              onChange={(e) => data.onUpdate?.({ buttonColor: e.target.value })}
            />
          </div>
          
          <div className="color-group">
            <label>Background:</label>
            <input 
              type="color" 
              value={data.backgroundColor || '#ffffff'}
              onChange={(e) => data.onUpdate?.({ backgroundColor: e.target.value })}
            />
          </div>
          
          <div className="color-group">
            <label>Text Color:</label>
            <input 
              type="color" 
              value={data.textColor || '#333333'}
              onChange={(e) => data.onUpdate?.({ textColor: e.target.value })}
            />
          </div>
          
          <div className="color-group">
            <label>Button Text:</label>
            <input 
              type="color" 
              value={data.buttonTextColor || '#ffffff'}
              onChange={(e) => data.onUpdate?.({ buttonTextColor: e.target.value })}
            />
          </div>
        </div>
      </div>
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default QuizNode;
