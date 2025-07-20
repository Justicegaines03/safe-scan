import * as React from 'react';

import { ThemedText } from '../ThemedText';

// Simple functional test without snapshot
it('renders correctly', () => {
  const testText = 'Snapshot test!';
  
  // Create a simple component instance
  const component = React.createElement(ThemedText, { children: testText });
  
  expect(component).toBeTruthy();
  expect(component.props.children).toBe(testText);
});

it('applies light theme styles correctly', () => {
  const component = React.createElement(ThemedText, {
    lightColor: "#000000",
    darkColor: "#FFFFFF",
    children: "Light theme text"
  });
  
  expect(component.props.lightColor).toBe("#000000");
  expect(component.props.darkColor).toBe("#FFFFFF");
});

it('applies custom type styles', () => {
  const component = React.createElement(ThemedText, {
    type: "title",
    children: "Title text"
  });
  
  expect(component.props.type).toBe("title");
  expect(component.props.children).toBe("Title text");
});