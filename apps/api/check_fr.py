import sys
print("Python:", sys.version)

try:
    import tokenizers
    print("tokenizers OK")
except Exception as e:
    print("tokenizers FAIL:", e)

try:
    import onnxruntime
    print("onnxruntime OK")
except Exception as e:
    print("onnxruntime FAIL:", e)

try:
    import flashrank
    print("flashrank OK:", flashrank.__version__)
except Exception as e:
    print("flashrank FAIL:", e)
