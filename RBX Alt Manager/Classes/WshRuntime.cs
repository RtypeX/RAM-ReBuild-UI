using System;
using System.Reflection;

namespace IWshRuntimeLibrary
{
    public interface IWshShortcut
    {
        string Description { get; set; }
        string TargetPath { get; set; }
        string WorkingDirectory { get; set; }
        void Save();
    }

    public sealed class WshShell
    {
        public IWshShortcut CreateShortcut(string path) => new WshShortcut(path);
    }

    internal sealed class WshShortcut : IWshShortcut
    {
        private readonly object _shortcut;
        private readonly Type _shortcutType;

        public WshShortcut(string path)
        {
            Type shellType = Type.GetTypeFromProgID("WScript.Shell")
                ?? throw new InvalidOperationException("WScript.Shell is not available on this system.");

            object shell = Activator.CreateInstance(shellType);

            _shortcut = shellType.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { path });
            _shortcutType = _shortcut.GetType();
        }

        public string Description
        {
            get => (string)_shortcutType.InvokeMember("Description", BindingFlags.GetProperty, null, _shortcut, null);
            set => _shortcutType.InvokeMember("Description", BindingFlags.SetProperty, null, _shortcut, new object[] { value });
        }

        public string TargetPath
        {
            get => (string)_shortcutType.InvokeMember("TargetPath", BindingFlags.GetProperty, null, _shortcut, null);
            set => _shortcutType.InvokeMember("TargetPath", BindingFlags.SetProperty, null, _shortcut, new object[] { value });
        }

        public string WorkingDirectory
        {
            get => (string)_shortcutType.InvokeMember("WorkingDirectory", BindingFlags.GetProperty, null, _shortcut, null);
            set => _shortcutType.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, _shortcut, new object[] { value });
        }

        public void Save() => _shortcutType.InvokeMember("Save", BindingFlags.InvokeMethod, null, _shortcut, null);
    }
}
